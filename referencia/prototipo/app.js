import { decodeKey, keyFromQR, parseNota, suggestName, onlyDigits, formatCNPJ } from './nfce.js';
import * as db from './db.js';
import { arquivoParaCanvas, lerQR, lerChaveDaFoto } from './img.js';

// Página de consulta pública da SEFAZ de cada UF (por enquanto só Pernambuco).
const SEFAZ = { PE: 'https://nfce.sefaz.pe.gov.br/nfce-web/consNfce' };

const $ = (id) => document.getElementById(id);
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const horaBR = (iso) => iso.slice(11, 16);

/** Cria elemento sem usar innerHTML (os textos vêm de fora). */
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f.nodeType ? f : document.createTextNode(String(f)));
  return el;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
function status(id, msg, tipo = '') {
  const el = $(id);
  el.textContent = msg;
  el.className = 'status ' + tipo;
}

const estado = { chave: null, qrUrl: null, jaImportada: null };

// ---------- Abas ----------
function abrirAba(nome) {
  for (const b of document.querySelectorAll('.abas button')) b.setAttribute('aria-selected', String(b.dataset.aba === nome));
  for (const s of document.querySelectorAll('.aba')) s.hidden = s.id !== `aba-${nome}`;
  if (nome === 'compras') renderCompras();
  if (nome === 'precos') renderPrecos();
}
document.querySelector('.abas').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-aba]');
  if (b) abrirAba(b.dataset.aba);
});

// ---------- 1. Chave ----------
function agrupar(d) { return d.replace(/(\d{4})(?=\d)/g, '$1 '); }

async function validarChave() {
  const inp = $('chave');
  const d = onlyDigits(inp.value).slice(0, 44);
  inp.value = agrupar(d);
  estado.chave = null;
  estado.jaImportada = null;
  $('btn-sefaz').disabled = true;
  $('passo-sefaz').classList.add('desativado');

  if (d.length === 0) { status('chave-status', ''); return; }
  if (d.length < 44) { status('chave-status', `${d.length}/44 dígitos`); return; }

  const k = decodeKey(d);
  if (!k.ok) { status('chave-status', k.error, 'erro'); return; }
  if (!k.ehNFCe) { status('chave-status', 'Esta chave não é de NFC-e (modelo 65).', 'erro'); return; }

  estado.chave = k;
  const ja = await db.compras.obter(k.chave);
  estado.jaImportada = ja || null;
  const base = `Chave válida: nota ${k.numero}, série ${k.serie}, ${k.uf}, ${String(k.mes).padStart(2, '0')}/${k.ano}, CNPJ ${formatCNPJ(k.cnpj)}.`;
  status('chave-status', ja ? `${base} Já importada em ${dataBR(ja.importadoEm)}.` : base, ja ? 'erro' : 'ok');

  if (SEFAZ[k.uf]) {
    $('btn-sefaz').disabled = false;
    $('passo-sefaz').classList.remove('desativado');
    status('sefaz-status', '');
  } else {
    status('sefaz-status', `Consulta automática ainda só configurada para PE. Para ${k.uf}, abra o site da SEFAZ do estado e cole o texto no passo 3.`, 'erro');
  }
}
$('chave').addEventListener('input', validarChave);

// ---------- QR Code (câmera ao vivo) ----------
let stream, timer, lendoQuadro = false;
function pararCamera() {
  clearInterval(timer);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  $('scanner').hidden = true;
}

/** Preenche o campo com uma chave vinda de QR/foto e valida. */
function usarChave(chave, qrUrl = null) {
  estado.qrUrl = qrUrl && /^https?:\/\//i.test(qrUrl) ? qrUrl : null;
  $('qr-extra').hidden = !estado.qrUrl;
  $('candidatas').hidden = true;
  $('chave').value = chave;
  return validarChave();
}

$('btn-fechar-qr').addEventListener('click', () => { pararCamera(); status('img-status', ''); });
$('btn-qr').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    status('img-status', 'Este navegador não abre a câmera aqui. Use "Tirar foto" ou digite a chave.', 'erro');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const v = $('video');
    v.srcObject = stream;
    await v.play();
    $('scanner').hidden = false;
    status('img-status', 'Aponte para o QR Code da nota.');
    timer = setInterval(async () => {
      if (lendoQuadro || !v.videoWidth) return;
      lendoQuadro = true;
      try {
        const r = await lerQR(v);
        if (!r) return;
        pararCamera();
        status('img-status', 'QR Code lido.', 'ok');
        await usarChave(r.chave, r.conteudo);
      } catch { /* quadro sem QR: segue tentando */ } finally { lendoQuadro = false; }
    }, 350);
  } catch {
    pararCamera();
    status('img-status', 'Não consegui abrir a câmera. Verifique a permissão, ou use "Tirar foto" / "Enviar imagem".', 'erro');
  }
});
$('btn-abrir-qr').addEventListener('click', () => {
  if (estado.qrUrl) window.open(estado.qrUrl, '_blank', 'noopener');
});

// ---------- Foto / imagem (QR primeiro, depois OCR da chave impressa) ----------
$('btn-foto').addEventListener('click', () => { pararCamera(); $('arq-foto').click(); });
$('btn-imagem').addEventListener('click', () => { pararCamera(); $('arq-imagem').click(); });
$('arq-foto').addEventListener('change', (e) => processarImagem(e.target));
$('arq-imagem').addEventListener('change', (e) => processarImagem(e.target));

const fmtChave = (c) => c.replace(/(\d{4})(?=\d)/g, '$1 ');

async function processarImagem(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const prog = $('progresso');
  $('candidatas').hidden = true;
  $('candidatas').replaceChildren();
  try {
    status('img-status', 'Abrindo a imagem...');
    const canvas = await arquivoParaCanvas(file);
    $('previa-img').src = canvas.toDataURL('image/jpeg', 0.6);
    $('previa').hidden = false;

    status('img-status', 'Procurando QR Code...');
    const qr = await lerQR(canvas);
    if (qr) {
      status('img-status', 'QR Code encontrado na imagem.', 'ok');
      await usarChave(qr.chave, qr.conteudo);
      return;
    }

    status('img-status', 'Lendo os números da nota (leva alguns segundos)...');
    prog.hidden = false; prog.value = 0;
    const conhecidos = [...new Set((await db.mapa.todos()).map((m) => m.k.split(':')[0]))];
    const r = await lerChaveDaFoto(canvas, { cnpjsConhecidos: conhecidos, aoProgredir: (p) => { prog.value = p; } });

    if (r.exata) {
      status('img-status', 'Li a chave na foto. Confira os números abaixo antes de seguir.', 'ok');
      await usarChave(r.exata);
    } else if (r.candidatas) {
      status('img-status', 'A foto não ficou perfeita e corrigi dígitos que o leitor confundiu. Escolha a chave que bate com a sua nota:', 'erro');
      const box = $('candidatas');
      for (const c of r.candidatas) {
        box.append(h('button', { type: 'button', class: 'sec', onclick: () => { status('img-status', ''); usarChave(c.chave); } },
          fmtChave(c.chave), c.trocas ? `  (${c.trocas} dígito(s) corrigido(s))` : ''));
      }
      box.hidden = false;
    } else {
      status('img-status', r.ambiguo
        ? 'Li números demais com dúvida para adivinhar. Tire outra foto, bem de perto da linha da chave e com boa luz, ou digite.'
        : 'Não encontrei a chave na imagem. Tente de novo com a nota esticada e a linha da chave bem à vista, ou digite.', 'erro');
    }
  } catch (err) {
    status('img-status', err.message || 'Não consegui ler essa imagem.', 'erro');
  } finally {
    prog.hidden = true;
  }
}

// ---------- 2. Abrir SEFAZ ----------
$('btn-sefaz').addEventListener('click', async () => {
  const k = estado.chave;
  if (!k) return;
  let copiou = true;
  try { await navigator.clipboard.writeText(k.chave); } catch { copiou = false; }
  window.open(SEFAZ[k.uf], '_blank', 'noopener');
  status('sefaz-status', copiou
    ? 'Chave copiada. Na SEFAZ: cole no campo, marque o captcha e toque em Consultar. Depois copie o texto e volte aqui.'
    : 'Não consegui copiar sozinho. Selecione a chave acima, copie e cole no site da SEFAZ.', copiou ? 'ok' : 'erro');
});

// ---------- 3. Colar e ler ----------
$('btn-colar').addEventListener('click', async () => {
  try {
    $('texto').value = await navigator.clipboard.readText();
    lerNota();
  } catch {
    status('ler-status', 'O navegador não deixou colar sozinho. Toque e segure na caixa e escolha Colar.', 'erro');
  }
});
$('btn-ler').addEventListener('click', lerNota);

async function lerNota() {
  const { nota, avisos, erros } = parseNota($('texto').value);
  if (!$('texto').value.trim()) { status('ler-status', 'Cole o texto da nota primeiro.', 'erro'); return; }

  // A chave digitada no passo 1 precisa ser a mesma da nota colada.
  if (estado.chave && nota.chave && estado.chave.chave !== nota.chave) {
    erros.push('A chave do texto colado é diferente da chave do passo 1. Você colou a nota certa?');
  }
  if (!estado.chave && nota.chave) {
    $('chave').value = nota.chave;
    await validarChave();
  }
  if (nota.cpfNaNota) avisos.push('A nota parece ter CPF. O app não guarda o CPF, só itens e preços.');

  status('ler-status', erros.length ? 'Encontrei problemas.' : `Li ${nota.itens.length} itens.`, erros.length ? 'erro' : 'ok');
  await renderConferencia(nota, avisos, erros);
}

async function renderConferencia(nota, avisos, erros) {
  const box = $('conferencia');
  box.hidden = false;
  box.replaceChildren();

  const mapa = new Map((await db.mapa.todos()).map((m) => [m.k, m.produto]));
  const chaveNota = nota.chave || (estado.chave && estado.chave.chave) || `${nota.loja.cnpj}-${nota.serie}-${nota.numero}`;
  const existente = await db.compras.obter(chaveNota);

  box.append(
    h('h2', {}, '4. Conferir e salvar'),
    h('div', { class: 'resumo' },
      h('span', {}, 'Mercado'), h('b', {}, nota.loja.nome || '?'),
      h('span', {}, 'Data'), h('b', {}, nota.emissao ? `${dataBR(nota.emissao)} ${horaBR(nota.emissao)}` : '?'),
      h('span', {}, 'Itens'), h('b', {}, String(nota.itens.length)),
      h('span', {}, 'Soma dos itens'), h('b', {}, brl(nota.somaItens || 0)),
      h('span', {}, 'Valor pago'), h('b', {}, nota.valorPagar != null ? brl(nota.valorPagar) : '?'),
    ),
    ...erros.map((e) => h('div', { class: 'erro-box' }, e)),
    ...avisos.map((a) => h('div', { class: 'aviso' }, a)),
    existente ? h('div', { class: 'aviso' }, 'Esta nota já foi importada. Salvar vai substituir a anterior.') : null,
    h('h3', {}, 'Nome de cada produto no seu catálogo'),
    h('p', { class: 'dica' }, 'O app lembra a escolha para este mercado: nas próximas notas os itens já vêm casados.'),
  );

  const campos = nota.itens.map((it) => {
    const k = `${nota.loja.cnpj}:${it.codigo}`;
    const conhecido = mapa.get(k);
    const inp = h('input', { value: conhecido || suggestName(it.descricao), 'aria-label': `Produto para ${it.descricao}` });
    const base = it.un === 'KG' ? '/kg' : '/un';
    box.append(h('div', { class: 'item' },
      h('div', { class: 'desc' }, it.descricao, conhecido ? null : h('span', { class: 'tag-novo' }, 'novo')),
      h('div', { class: 'nums' },
        h('span', {}, `${String(it.qtd).replace('.', ',')} ${it.un === 'KG' ? 'kg' : 'un'} × ${brl(it.vlUnit)}${base}`),
        h('b', {}, brl(it.vlTotal))),
      inp));
    return { it, k, inp };
  });

  const salvar = h('button', { type: 'button', disabled: erros.length > 0 }, existente ? 'Substituir nota' : 'Salvar nota');
  const cancelar = h('button', { type: 'button', class: 'sec', onclick: () => { box.hidden = true; box.replaceChildren(); } }, 'Cancelar');
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    const itens = campos.map(({ it, inp }) => ({ ...it, produto: inp.value.trim() || suggestName(it.descricao) }));
    await db.compras.salvar({
      chave: chaveNota,
      loja: nota.loja,
      numero: nota.numero, serie: nota.serie,
      emissao: nota.emissao, protocolo: nota.protocolo,
      pagamento: nota.pagamento, valorPagar: nota.valorPagar,
      itens, importadoEm: new Date().toISOString(),
    });
    for (const { it, k, inp } of campos) await db.mapa.salvar(k, inp.value.trim() || suggestName(it.descricao));
    toast(`Nota salva: ${itens.length} itens, ${brl(nota.valorPagar ?? nota.somaItens)}.`);
    $('texto').value = ''; $('chave').value = ''; estado.qrUrl = null; $('qr-extra').hidden = true;
    status('ler-status', ''); status('sefaz-status', ''); status('chave-status', '');
    await validarChave();
    box.hidden = true; box.replaceChildren();
    abrirAba('compras');
  });
  box.append(h('div', { class: 'linha', style: 'margin-top:12px' }, salvar, cancelar));
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Compras ----------
async function renderCompras() {
  const lista = await db.compras.todas();
  const alvo = $('lista-compras');
  alvo.replaceChildren();
  if (!lista.length) { alvo.append(h('div', { class: 'cartao vazio' }, 'Nenhuma nota importada ainda.')); return; }
  for (const c of lista) {
    const tabela = h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', { class: 'n' }, 'Qtde'), h('th', { class: 'n' }, 'Preço'), h('th', { class: 'n' }, 'Total'))),
      h('tbody', {}, c.itens.map((i) => h('tr', {},
        h('td', {}, i.produto),
        h('td', { class: 'n' }, `${String(i.qtd).replace('.', ',')} ${i.un === 'KG' ? 'kg' : 'un'}`),
        h('td', { class: 'n' }, brl(i.vlUnit)),
        h('td', { class: 'n' }, brl(i.vlTotal))))));
    alvo.append(h('div', { class: 'cartao' },
      h('details', {},
        h('summary', {}, h('span', {}, `${dataBR(c.emissao)} · ${c.loja.nome}`), h('span', { class: 'preco' }, brl(c.valorPagar ?? c.itens.reduce((s, i) => s + i.vlTotal, 0)))),
        h('p', { class: 'dica' }, `${c.itens.length} itens · nota ${c.numero} · ${c.pagamento || ''}`),
        tabela,
        h('div', { style: 'margin-top:10px' }, h('button', {
          type: 'button', class: 'perigo',
          onclick: async () => { if (confirm('Apagar esta compra?')) { await db.compras.apagar(c.chave); renderCompras(); } },
        }, 'Apagar compra')))));
  }
}

// ---------- Preços ----------
async function renderPrecos() {
  const lista = await db.compras.todas();
  const alvo = $('lista-precos');
  alvo.replaceChildren();
  const grupos = new Map();
  for (const c of lista) {
    for (const i of c.itens) {
      const base = i.un === 'KG' ? 'kg' : 'un';
      const k = `${i.produto}|${base}`;
      if (!grupos.has(k)) grupos.set(k, { produto: i.produto, base, regs: [] });
      grupos.get(k).regs.push({ data: c.emissao, loja: c.loja.nome, preco: i.vlUnit });
    }
  }
  if (!grupos.size) { alvo.append(h('div', { class: 'cartao vazio' }, 'Importe uma nota para começar o histórico de preços.')); return; }

  const itens = [...grupos.values()].sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
  const cartao = h('div', { class: 'cartao' }, h('h2', {}, 'Preço por unidade de cada produto'));
  for (const g of itens) {
    g.regs.sort((a, b) => b.data.localeCompare(a.data)); // mais recente primeiro
    const [ult, ant] = g.regs;
    let delta = null;
    if (ant && ant.preco > 0) {
      const p = ((ult.preco - ant.preco) / ant.preco) * 100;
      if (Math.abs(p) >= 0.5) delta = h('span', { class: p > 0 ? 'sobe' : 'desce' }, ` ${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%`);
    }
    const precos = g.regs.map((r) => r.preco);
    cartao.append(h('details', {},
      h('summary', {}, h('span', {}, g.produto), h('span', { class: 'preco' }, `${brl(ult.preco)}/${g.base}`, delta)),
      h('p', { class: 'dica' }, `${g.regs.length} compra(s) · menor ${brl(Math.min(...precos))} · maior ${brl(Math.max(...precos))}`),
      h('table', {}, h('tbody', {}, g.regs.map((r) => h('tr', {},
        h('td', {}, dataBR(r.data)), h('td', {}, r.loja), h('td', { class: 'n' }, `${brl(r.preco)}/${g.base}`)))))));
  }
  alvo.append(cartao);
}

// ---------- Backup ----------
$('btn-exportar').addEventListener('click', async () => {
  const dados = await db.exportar();
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `despensa-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  status('backup-status', `Backup com ${dados.compras.length} compra(s) exportado.`, 'ok');
});
$('arq-backup').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const n = await db.importar(JSON.parse(await f.text()));
    status('backup-status', `${n} compra(s) importada(s).`, 'ok');
    renderCompras();
  } catch (err) {
    status('backup-status', err.message || 'Não consegui ler esse arquivo.', 'erro');
  }
  e.target.value = '';
});

// ---------- Receber texto via "Compartilhar" (Android, PWA instalado) ----------
(function receberCompartilhado() {
  const p = new URLSearchParams(location.search);
  const texto = [p.get('text'), p.get('title'), p.get('url')].filter(Boolean).join('\n');
  if (!texto) return;
  history.replaceState(null, '', location.pathname);
  $('texto').value = texto;
  abrirAba('importar');
  lerNota();
})();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
