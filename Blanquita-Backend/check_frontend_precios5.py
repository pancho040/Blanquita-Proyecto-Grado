with open("../Blanquita-Frontend/src/components/Logistica/Precios/TablaPrecios.jsx", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("formatearMoneda")
if idx != -1:
    print(text[idx-50:idx+600])
else:
    print("No se encontró formatearMoneda")
