import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeKey, keyFromQR, parseNota, parseBR, suggestName, calcDV } from '../nfce.js';

const sample = readFileSync(new URL('../sample/nota-exemplo.txt', import.meta.url), 'utf8');
const CHAVE = '26261108868231000638650020000689031020778720';
let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok  -', nome); };

t('parseBR', () => {
  assert.equal(parseBR('7,88'), 7.88);
  assert.equal(parseBR('1.234,56'), 1234.56);
  assert.equal(parseBR('12'), 12);
});

t('chave válida é decomposta', () => {
  const k = decodeKey(CHAVE);
  assert.ok(k.ok);
  assert.equal(k.uf, 'PE');
  assert.equal(k.cnpj, '08868231000638');
  assert.equal(k.modelo, '65');
  assert.equal(k.serie, 2);
  assert.equal(k.numero, 68903);
  assert.ok(k.ehNFCe);
});

t('chave com espaços (como impressa) é aceita', () => {
  assert.ok(decodeKey('2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720').ok);
});

t('chave com dígito trocado é rejeitada', () => {
  const ruim = CHAVE.slice(0, 30) + '9' + CHAVE.slice(31);
  assert.equal(decodeKey(ruim).ok, false);
});

t('chave curta é rejeitada com mensagem clara', () => {
  const r = decodeKey('123');
  assert.equal(r.ok, false);
  assert.match(r.error, /3 dígitos/);
});

t('DV calculado bate', () => assert.equal(calcDV(CHAVE.slice(0, 43)), 0));

t('chave sai da URL do QR Code v2', () => {
  const url = `http://nfce.sefaz.pe.gov.br/nfce/consulta?p=${CHAVE}|2|1|1|A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2`;
  assert.equal(keyFromQR(url), CHAVE);
});

t('chave sai da URL do QR Code v1 (chNFe=)', () => {
  assert.equal(keyFromQR(`http://x/qr?chNFe=${CHAVE}&nVersao=100&tpAmb=1`), CHAVE);
});

t('QR sem chave devolve null', () => assert.equal(keyFromQR('https://exemplo.com/abc'), null));

const { nota, avisos, erros } = parseNota(sample);

t('nota de exemplo: sem erros nem avisos', () => {
  assert.deepEqual(erros, []);
  assert.deepEqual(avisos, []);
});

t('nota de exemplo: cabeçalho', () => {
  assert.equal(nota.loja.nome, 'CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA');
  assert.equal(nota.loja.cnpj, '08868231000638');
  assert.match(nota.loja.endereco, /OLINDA, PE$/);
  assert.equal(nota.numero, 68903);
  assert.equal(nota.serie, 2);
  assert.equal(nota.emissao, '2026-11-04T10:33:31');
  assert.equal(nota.chave, CHAVE);
  assert.equal(nota.protocolo, '226261025408429');
  assert.equal(nota.pagamento, 'Cartão de Crédito');
  assert.equal(nota.cpfNaNota, false);
});

t('nota de exemplo: 16 itens e total 77,24', () => {
  assert.equal(nota.itens.length, 16);
  assert.equal(nota.totalItens, 16);
  assert.equal(nota.valorPagar, 77.24);
  assert.equal(nota.somaItens, 77.24);
});

t('nota de exemplo: itens lidos corretamente', () => {
  const [melao, , , coentro, , , , , , , , , , alho] = nota.itens;
  assert.deepEqual(melao, { descricao: 'MELAO JAPONES KG', codigo: '0000000000052', qtd: 1.26, un: 'KG', vlUnit: 7.88, vlTotal: 9.93 });
  assert.equal(coentro.un, 'UNID');
  assert.equal(alho.descricao, 'ALHO REDINHA PCT 180');
  assert.equal(alho.codigo, '0000000035024');
});

t('sugestão de nome tira a unidade', () => {
  assert.equal(suggestName('MELAO JAPONES KG'), 'Melao Japones');
  assert.equal(suggestName('COENTRO UN'), 'Coentro');
  assert.equal(suggestName('ALHO REDINHA PCT 180'), 'Alho Redinha');
});

t('total adulterado gera aviso', () => {
  const r = parseNota(sample.replace('Valor a pagar R$:77,24', 'Valor a pagar R$:80,00'));
  assert.equal(r.erros.length, 0);
  assert.ok(r.avisos.some((a) => /difere do valor a pagar/.test(a)));
});

t('item faltando gera erro de contagem', () => {
  const semGoiaba = sample.replace(/GOIABA KG[\s\S]*?6,36\n/, '');
  const r = parseNota(semGoiaba);
  assert.ok(r.erros.some((e) => /16 itens, mas li 15/.test(e)));
});

t('linha com conta errada gera aviso', () => {
  const r = parseNota(sample.replace('Qtde.: 1,26', 'Qtde.: 2,26'));
  assert.ok(r.avisos.some((a) => /MELAO JAPONES KG/.test(a)));
});

t('CNPJ divergente da chave gera erro', () => {
  const r = parseNota(sample.replace('CNPJ: 08.868.231/0006-38', 'CNPJ: 11.222.333/0001-81'));
  assert.ok(r.erros.some((e) => /CNPJ da chave/.test(e)));
});

t('texto sem relação com a nota gera erros, sem quebrar', () => {
  const r = parseNota('qualquer coisa');
  assert.ok(r.erros.length >= 2);
});

t('milhar com ponto', () => {
  const txt = 'LOJA X\nCNPJ: 08.868.231/0006-38\nFILE MIGNON KG(Código: 12)\nQtde.: 2,5  UN: KG  Vl. Unit.: 1.000,00\n\nVl. Total\n2.500,00\n\nQtd. total de itens:1\nValor a pagar R$:2.500,00\nData de Emissão: 01/01/2026 10:00:00';
  const r = parseNota(txt);
  assert.equal(r.nota.itens[0].vlUnit, 1000);
  assert.equal(r.nota.itens[0].vlTotal, 2500);
  assert.equal(r.nota.valorPagar, 2500);
  assert.deepEqual(r.erros, []);
});

console.log(`\n${n} testes passaram`);

// ---- OCR: reparo da chave ----
import { chaveDoOCR, cnpjOk } from '../nfce.js';
const IMP = '2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720';

t('CNPJ da nota passa no dígito verificador', () => assert.ok(cnpjOk('08868231000638')));

t('OCR perfeito, chave em duas linhas, com ruído em volta', () => {
  const txt = `Consulte pela Chave de Acesso em\nhttp://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe\nChave de acesso:\n2626 1108 8682 3100 0638 6500\n2000 0689 0310 2077 8720\nConsumidor não identificado`;
  assert.deepEqual(chaveDoOCR(txt), { exata: CHAVE });
});

t('OCR com o protocolo logo antes (números extras)', () => {
  const txt = `Protocolo de Autorização: 226261025408429 04/11/2026\nChave de acesso:\n${IMP}`;
  assert.equal(chaveDoOCR(txt).exata, CHAVE);
});

t('OCR trocou 1 dígito (8 virou 3): reparo achou a chave certa', () => {
  const ruim = IMP.replace('8682', '3682');
  const r = chaveDoOCR(`Chave de acesso:\n${ruim}`);
  assert.equal(r.exata, undefined);
  assert.equal(r.candidatas[0].chave, CHAVE);
  assert.equal(r.candidatas[0].trocas, 1);
});

t('OCR trocou 2 dígitos: nunca devolve chave errada como exata; ou acha entre poucas ou pede nova foto', () => {
  const ruim = IMP.replace('8682', '3682').replace('0689', '0688');
  for (const conhecidos of [[], ['08868231000638']]) {
    const r = chaveDoOCR(ruim, conhecidos);
    assert.equal(r.exata, undefined);
    assert.ok(r.vazio || (r.candidatas.length <= 3 && r.candidatas.some((c) => c.chave === CHAVE)));
  }
});

t('OCR com um dígito a mais ou a menos', () => {
  const mais = IMP.replace('0689', '06189');
  assert.ok((chaveDoOCR(mais).candidatas || []).some((c) => c.chave === CHAVE) || chaveDoOCR(mais).exata === CHAVE);
  // dígito a menos: há muitas posições possíveis; ou acha entre poucas ou pede nova foto, nunca chuta
  const r = chaveDoOCR(IMP.replace('0689', '068'));
  assert.equal(r.exata, undefined);
  assert.ok(r.vazio || r.candidatas.some((c) => c.chave === CHAVE));
});

t('texto sem chave devolve vazio', () => assert.deepEqual(chaveDoOCR('CUPOM\nTOTAL 12,50\nOBRIGADO'), { vazio: true }));

t('CNPJ conhecido desempata candidatas', () => {
  const ruim = IMP.replace('8682', '3682');
  assert.equal(chaveDoOCR(ruim, ['08868231000638']).candidatas[0].chave, CHAVE);
});
