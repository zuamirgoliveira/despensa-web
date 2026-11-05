// Núcleo do importador de NFC-e: chave de acesso, QR Code e leitura do texto da nota.
// Sem dependências, roda no navegador e no Node (para os testes).

const UF = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI',
  23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES',
  33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

export const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

/** Número em formato brasileiro ("1.234,56" ou "7,88") para Number. */
export function parseBR(s) {
  const t = String(s).trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t);
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const brl = (n) => 'R$ ' + n.toFixed(2).replace('.', ',');

/** Dígito verificador da chave (módulo 11, pesos 2 a 9). */
export function calcDV(key43) {
  let sum = 0;
  let w = 2;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += Number(key43[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return r === 0 || r === 1 ? 0 : 11 - r;
}

export function formatCNPJ(c) {
  const d = onlyDigits(c).padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Valida e decompõe a chave de 44 dígitos. */
export function decodeKey(raw) {
  const k = onlyDigits(raw);
  if (k.length !== 44) {
    return { ok: false, error: `A chave tem ${k.length} dígitos, precisa ter 44.` };
  }
  const dv = calcDV(k.slice(0, 43));
  if (dv !== Number(k[43])) {
    return { ok: false, error: 'Dígito verificador não confere: algum número está errado.' };
  }
  const modelo = k.slice(20, 22);
  return {
    ok: true,
    chave: k,
    uf: UF[Number(k.slice(0, 2))] || k.slice(0, 2),
    ano: 2000 + Number(k.slice(2, 4)),
    mes: Number(k.slice(4, 6)),
    cnpj: k.slice(6, 20),
    modelo,
    serie: Number(k.slice(22, 25)),
    numero: Number(k.slice(25, 34)),
    tpEmis: k[34],
    ehNFCe: modelo === '65',
  };
}

/** Extrai a chave de 44 dígitos do conteúdo de um QR Code de NFC-e (v1 ou v2). */
export function keyFromQR(text) {
  const t = String(text);
  const m = t.match(/(?<!\d)(\d{44})(?!\d)/) || t.replace(/\s/g, '').match(/(\d{44})/);
  return m ? m[1] : null;
}

/** Sugere um nome de produto a partir da descrição da nota (sem unidade no fim). */
export function suggestName(desc) {
  let d = String(desc).trim().toLowerCase();
  d = d.replace(/\s+(pct|cx|bdj|und|unid|un|kg)\b.*$/i, '');
  d = d.replace(/\s+/g, ' ').trim();
  return d.replace(/(^|\s)([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase());
}

/**
 * Lê o texto copiado da página de consulta da NFC-e.
 * Retorna { nota, avisos, erros }. Erros impedem salvar; avisos pedem atenção.
 */
export function parseNota(texto) {
  const avisos = [];
  const erros = [];
  const t = String(texto ?? '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
  const linhas = t.split('\n').map((l) => l.trim());

  // Mercado
  const iCnpj = linhas.findIndex((l) => /^CNPJ:/i.test(l));
  const loja = { nome: '', cnpj: '', endereco: '' };
  if (iCnpj >= 0) {
    loja.cnpj = onlyDigits(linhas[iCnpj]);
    for (let i = iCnpj - 1; i >= 0; i--) {
      if (linhas[i]) { loja.nome = linhas[i]; break; }
    }
    const end = linhas[iCnpj + 1];
    if (end && !/^filtrar itens/i.test(end)) loja.endereco = end.replace(/\s+,/g, ',').replace(/,\s+/g, ', ');
  } else {
    erros.push('Não encontrei o CNPJ do mercado. O texto colado é da página da nota?');
  }

  // Itens
  const reItem = /([^\n]+?)\s*\(C[óo]digo:\s*(\d+)\)\s*Qtde\.:\s*([\d.,]+)\s+UN:\s*(\S+)\s+Vl\.\s*Unit\.:\s*([\d.,]+)\s*Vl\.\s*Total\s*([\d.,]+)/g;
  const itens = [];
  for (const m of t.matchAll(reItem)) {
    itens.push({
      descricao: m[1].trim(),
      codigo: m[2],
      qtd: parseBR(m[3]),
      un: m[4].toUpperCase(),
      vlUnit: parseBR(m[5]),
      vlTotal: parseBR(m[6]),
    });
  }
  if (!itens.length) erros.push('Não encontrei nenhum item no texto.');

  // Cabeçalho e totais
  const num = (re) => { const m = t.match(re); return m ? m[1] : null; };
  const totalItens = num(/Qtd\.\s*total de itens:\s*(\d+)/i);
  const valorPagar = num(/Valor a pagar R\$:\s*([\d.,]+)/i);
  const pg = t.match(/Forma de pagamento:[^\n]*\n\s*([^\n]*?)\s*([\d.]+,\d{2})\s*(?:\n|$)/i);
  const numero = num(/N[úu]mero:\s*(\d+)/i);
  const serie = num(/S[ée]rie:\s*(\d+)/i);
  const dt = t.match(/Data de Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
  const protocolo = num(/Protocolo de Autoriza[çc][ãa]o:\s*(\d+)/i);
  const kc = t.match(/Chave de acesso:\s*((?:\d{4}\s*){11})/i);

  const nota = {
    loja,
    itens,
    numero: numero ? Number(numero) : null,
    serie: serie ? Number(serie) : null,
    emissao: dt ? `${dt[3]}-${dt[2]}-${dt[1]}T${dt[4]}` : null,
    protocolo,
    chave: kc ? onlyDigits(kc[1]) : null,
    totalItens: totalItens ? Number(totalItens) : null,
    valorPagar: valorPagarNum(valorPagar),
    pagamento: pg ? pg[1].trim() : null,
    cpfNaNota: /CPF/i.test(t) && !/n[ãa]o identificado/i.test(t),
  };

  if (!nota.emissao) erros.push('Não encontrei a data de emissão.');

  // Conferências
  const soma = round2(itens.reduce((s, i) => s + i.vlTotal, 0));
  nota.somaItens = soma;
  if (nota.valorPagar != null && itens.length) {
    const dif = round2(soma - nota.valorPagar);
    if (Math.abs(dif) > 0.05) {
      avisos.push(`A soma dos itens (${brl(soma)}) difere do valor a pagar (${brl(nota.valorPagar)}). Pode haver desconto ou item faltando.`);
    }
  } else if (itens.length) {
    avisos.push('Não encontrei o valor a pagar para conferir o total.');
  }
  if (nota.totalItens != null && nota.totalItens !== itens.length) {
    erros.push(`A nota informa ${nota.totalItens} itens, mas li ${itens.length}.`);
  }
  for (const i of itens) {
    const esperado = round2(i.qtd * i.vlUnit);
    if (Math.abs(esperado - i.vlTotal) > 0.02) {
      avisos.push(`${i.descricao}: ${String(i.qtd).replace('.', ',')} × ${brl(i.vlUnit)} = ${brl(esperado)}, mas a nota diz ${brl(i.vlTotal)}.`);
    }
  }

  if (nota.chave) {
    const k = decodeKey(nota.chave);
    if (!k.ok) erros.push(`Chave de acesso no texto inválida: ${k.error}`);
    else {
      if (loja.cnpj && k.cnpj !== loja.cnpj) erros.push('O CNPJ da chave não bate com o CNPJ do mercado no texto.');
      if (nota.numero != null && k.numero !== nota.numero) erros.push('O número da nota não bate com a chave.');
      if (!k.ehNFCe) avisos.push('A chave não é de NFC-e (modelo 65).');
    }
  } else {
    avisos.push('Não encontrei a chave de acesso no texto; não dá para evitar importar a mesma nota duas vezes.');
  }

  return { nota, avisos, erros };
}

function valorPagarNum(s) {
  return s == null ? null : parseBR(s);
}

// ---------------------------------------------------------------------------
// Leitura da chave a partir de OCR (foto da nota)
// ---------------------------------------------------------------------------

/** Confere os dois dígitos verificadores de um CNPJ (14 dígitos). */
export function cnpjOk(c) {
  const d = onlyDigits(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dig = (base, pesos) => {
    const s = base.split('').reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d1 = dig(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dig(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** Uma chave plausível: DV ok, modelo 65, UF/ano/mês possíveis, emissão normal ou offline, CNPJ válido. */
export function chavePlausivel(k) {
  const r = decodeKey(k);
  return r.ok && r.ehNFCe && !!UF[Number(k.slice(0, 2))] && r.ano >= 2019 && r.ano <= 2040
    && r.mes >= 1 && r.mes <= 12 && (r.tpEmis === '1' || r.tpEmis === '9') && cnpjOk(r.cnpj);
}

// Troca típica do OCR em papel térmico: dígito lido -> dígitos que podem ser o verdadeiro.
const CONFUSAO = {
  0: '86', 1: '7', 2: '7', 3: '85', 4: '9', 5: '63', 6: '580', 7: '12', 8: '0369', 9: '840',
};

/** Variações com 1 (e, se preciso, 2) dígitos trocados por confusões comuns do OCR. */
function variacoes(s) {
  const out = [];
  const troca = (str, i, c) => str.slice(0, i) + c + str.slice(i + 1);
  for (let i = 0; i < s.length; i++) {
    for (const c of CONFUSAO[s[i]] || '') out.push({ chave: troca(s, i, c), trocas: 1 });
  }
  return out;
}
function variacoes2(s) {
  const out = [];
  const troca = (str, i, c) => str.slice(0, i) + c + str.slice(i + 1);
  for (let i = 0; i < s.length; i++) {
    for (const c of CONFUSAO[s[i]] || '') {
      const a = troca(s, i, c);
      for (let j = i + 1; j < s.length; j++) {
        for (const c2 of CONFUSAO[s[j]] || '') out.push({ chave: troca(a, j, c2), trocas: 2 });
      }
    }
  }
  return out;
}

/**
 * Procura a chave no texto devolvido pelo OCR.
 * Retorna { exata: 'chave' } quando achou uma chave válida como veio,
 * ou { candidatas: [{chave, trocas}] } quando foi preciso corrigir dígitos
 * (o usuário deve conferir), ou { vazio: true }.
 * `cnpjsConhecidos` (opcional) ajuda a desempatar com mercados já usados.
 */
export function chaveDoOCR(texto, cnpjsConhecidos = []) {
  const linhas = String(texto).split('\n').map((l) => onlyDigits(l));
  const todos = linhas.join('');

  // 1) alguma janela de 44 dígitos já é uma chave válida?
  for (let i = 0; i + 44 <= todos.length; i++) {
    const j = todos.slice(i, i + 44);
    if (chavePlausivel(j)) return { exata: j };
  }

  // 2) blocos de linhas numéricas consecutivas (a chave costuma quebrar em 2 linhas)
  const blocos = [];
  let atual = '';
  for (const l of linhas) {
    if (l.length >= 8) atual += l;
    else if (atual) { blocos.push(atual); atual = ''; }
  }
  if (atual) blocos.push(atual);

  const base = new Map(); // possível chave -> ajustes já feitos (dígito sobrando/faltando)
  const add = (v, custo) => { if (!base.has(v) || base.get(v) > custo) base.set(v, custo); };
  for (const b of blocos) {
    if (b.length === 44) add(b, 0);
    if (b.length === 45) for (let i = 0; i < 45; i++) add(b.slice(0, i) + b.slice(i + 1), 1); // dígito a mais
    if (b.length === 43) for (let i = 0; i <= 43; i++) for (let d = 0; d < 10; d++) add(b.slice(0, i) + d + b.slice(i), 1); // dígito a menos
    if (b.length > 45) { // chave junto com outros números: janelas que começam por UF conhecida
      for (let i = 0; i + 44 <= b.length; i++) if (UF[Number(b.slice(i, i + 2))]) add(b.slice(i, i + 44), 0);
    }
  }

  const achadas = new Map();
  const consider = (lista) => {
    for (const v of lista) if (chavePlausivel(v.chave) && !achadas.has(v.chave)) achadas.set(v.chave, v);
  };
  // Etapas, da correção mais simples para a mais ousada; para na primeira que achar algo.
  // 0) só o dígito sobrando/faltando; 1) uma troca de dígito; 2) duas trocas.
  for (const [b, custo] of base) if (custo > 0) consider([{ chave: b, trocas: custo }]);
  if (!achadas.size) {
    for (const [b, custo] of base) consider(variacoes(b).map((v) => ({ ...v, trocas: v.trocas + custo })));
  }
  if (!achadas.size) {
    // Dois dígitos errados geram muitas chaves "válidas" por acaso (o dígito verificador
    // só descarta 10 de cada 11). Com mercado já conhecido, prefere esse CNPJ.
    for (const [b, custo] of base) consider(variacoes2(b).map((v) => ({ ...v, trocas: v.trocas + custo })));
    const conhecidas = [...achadas.values()].filter((v) => cnpjsConhecidos.includes(decodeKey(v.chave).cnpj));
    if (conhecidas.length) {
      achadas.clear();
      for (const v of conhecidas) achadas.set(v.chave, v);
    }
  }

  if (!achadas.size) return { vazio: true };
  if (achadas.size > 3) return { vazio: true, ambiguo: true };
  const pontos = (v) => {
    const k = decodeKey(v.chave);
    return (cnpjsConhecidos.includes(k.cnpj) ? -10 : 0) + (k.uf === 'PE' ? -2 : 0) + v.trocas;
  };
  const candidatas = [...achadas.values()].sort((a, b) => pontos(a) - pontos(b)).slice(0, 3);
  return { candidatas };
}
