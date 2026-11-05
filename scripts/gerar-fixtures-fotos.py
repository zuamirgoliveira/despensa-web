# Gera as imagens sintéticas de tests/fixtures/fotos (precisa de: pip install segno pillow).
# Uso: python3 scripts/gerar-fixtures-fotos.py
import os, random
import segno
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "fotos") + os.sep
CHAVE = "26261108868231000638650020000689031020778720"
url = f"http://nfce.sefaz.pe.gov.br/nfce/consulta?p={CHAVE}|2|1|1|" + "A1B2C3D4E5" * 4
segno.make(url, error=None).save(OUT + "qr-nota.png", scale=8, border=4)

random.seed(7)
# 1) ruído puro
img = Image.new("L", (400, 500))
img.putdata([random.randint(0, 255) for _ in range(400 * 500)])
img.save(OUT + "ruido.png")

# 2) 44 dígitos impressos, mas com dígito verificador errado e sem nenhum QR
digitos = "26261108868231000638650020000689031020778721"
fonte = ImageFont.load_default(size=44)
img = Image.new("L", (1200, 400), 255)
d = ImageDraw.Draw(img)
g = " ".join(digitos[i:i + 4] for i in range(0, 44, 4))
d.text((20, 40), "CHAVE DE ACESSO", fill=0, font=fonte)
d.text((20, 140), g[:30], fill=0, font=fonte)
d.text((20, 220), g[30:], fill=0, font=fonte)
img.filter(ImageFilter.GaussianBlur(1.2)).save(OUT + "chave-dv-invalido.png")

# 3) texto qualquer
img = Image.new("L", (1000, 500), 255)
d = ImageDraw.Draw(img)
d.text((30, 50), "TOTAL 12,50", fill=0, font=fonte)
d.text((30, 150), "OBRIGADO VOLTE SEMPRE", fill=0, font=fonte)
img.save(OUT + "sem-chave.png")
