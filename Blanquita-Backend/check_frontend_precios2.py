with open("../Blanquita-Frontend/src/components/Logistica/Precios/TablaPrecios.jsx", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("item.PrecioUnitario")
if idx != -1:
    print(text[idx-100:idx+400])
