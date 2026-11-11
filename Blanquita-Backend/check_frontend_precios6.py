with open("../Blanquita-Frontend/src/components/Logistica/Precios/TablaPrecios.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "PrecioUnitario" in l and "<" in l:
        print(f"Línea {i+1}: {l.strip()}")
        for j in range(max(0, i-2), min(len(lines), i+6)):
            print(f"  {j+1}: {lines[j].strip()}")
