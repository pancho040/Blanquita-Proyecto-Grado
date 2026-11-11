with open("../Blanquita-Frontend/src/components/Logistica/Precios/TablaPrecios.jsx", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("PrecioUnitario")
if idx != -1:
    print(text[idx-200:idx+600])
