with open("../Blanquita-Frontend/src/components/Logistica/Precios/TablaPrecios.jsx", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("<td")
if idx != -1:
    print(text[idx:idx+1200])
