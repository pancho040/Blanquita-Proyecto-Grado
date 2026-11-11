with open("app/Repository/Contabilidad/CuentasCobrarRepository.py", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("def ListarCuentasCobrar")
if idx != -1:
    print(text[idx:idx+1500])
