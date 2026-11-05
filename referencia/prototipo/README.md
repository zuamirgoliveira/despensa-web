# Despensa (MVP pessoal): importador de NFC-e

PWA estático, sem build e sem backend. Dados só no aparelho (IndexedDB).

## Rodar local
    python3 -m http.server 8000     # e abrir http://localhost:8000
Câmera, área de transferência e instalação exigem HTTPS (ou localhost).

## Testes
    node tests/nfce.test.mjs

## Fluxo
1. Chave de 44 dígitos, de três formas, sempre validada pelo dígito verificador:
   - digitar ou colar;
   - escanear o QR Code com a câmera;
   - tirar foto ou enviar imagem: o app procura um QR Code na imagem e, se não houver,
     lê a chave impressa por OCR (Tesseract, roda no aparelho). Dígitos que o OCR confunde
     (8/3, 5/6, 1/7...) são corrigidos só quando o dígito verificador permite; se houver
     dúvida, o app mostra até 3 opções ou pede outra foto, nunca chuta.
2. "Copiar chave e abrir SEFAZ": cole no campo, marque o captcha, Consultar.
3. Copie o texto da nota e cole no app (ou use Compartilhar, no Android com o PWA instalado).
4. Conferência (soma dos itens x valor pago) e nome do produto no seu catálogo; salva.

## Bibliotecas incluídas em vendor/ (rodam offline)
jsQR (leitor de QR, Apache-2.0) e Tesseract.js 5 + dados de idioma "eng" (OCR, Apache-2.0).
São carregadas só quando a foto/imagem é usada (~11 MB, ficam em cache depois).

## Hipóteses a validar com uso real
- A SEFAZ-PE aceita a chave por parâmetro de URL? (hoje o app só copia a chave)
- O link do QR Code abre a nota sem captcha? (botão "Abrir o link do QR")
- O OCR funciona em fotos reais de papel térmico (os testes usaram imagens sintéticas)?
- O texto copiado de outros mercados tem o mesmo formato da nota da Cia Santos?
