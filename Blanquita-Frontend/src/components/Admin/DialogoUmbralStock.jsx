import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BotonEnviar, ErrorDialogo } from "@/components/Admin/Usuarios/Dialogos";
import { CamposStock, errorStock } from "@/components/Admin/CamposStock";
import { ANCHO_DIALOGO_ADMIN, CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import { textoUmbral } from "@/components/Admin/MateriaPrima/comunes";
import { editarUmbralStock } from "@/services/AlertaStock/AlertaStock";

export function DialogoUmbralStock({ item, dominio, unidad, descripcion, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState({ StockMinimo: "", StockPreventivo: "" });
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setDatos({
      StockMinimo: item.StockMinimo ?? "",
      StockPreventivo: item.StockPreventivo ?? "",
    });
    setConfirmado(false);
    setError("");
  }, [item]);

  const sinCambios =
    item &&
    String(item.StockMinimo ?? "") === String(datos.StockMinimo) &&
    String(item.StockPreventivo ?? "") === String(datos.StockPreventivo);
  const valido = item && !errorStock(datos.StockMinimo, datos.StockPreventivo) && !sinCambios && confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      onGuardado(await editarUmbralStock(dominio, item.Id, datos));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className={ANCHO_DIALOGO_ADMIN}>
        <DialogHeader>
          <DialogTitle>Alerta de stock</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {item && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[15px] font-extrabold text-slate-900">{item.Nombre}</div>
              <div className="text-[12.5px] text-slate-500">
                {item.CantidadActual} {unidad} · {textoUmbral(item)}
              </div>
            </div>

            <CamposStock
              prefijoId="umbral"
              stockMinimo={datos.StockMinimo}
              stockPreventivo={datos.StockPreventivo}
              onCambio={(campo, valor) => {
                setDatos((previos) => ({ ...previos, [campo]: valor }));
                setConfirmado(false);
              }}
              unidad={unidad}
            />

            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo el cambio de alerta de ${item.Nombre}`}
            >
              El cambio quedará registrado en el historial de acciones del administrador con el valor
              anterior y el nuevo.
            </CasillaConfirmacion>

            {error && <ErrorDialogo mensaje={error} />}
          </div>
        )}

        <DialogFooter>
          <BotonEnviar
            onClick={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            className="bg-slate-900 hover:bg-slate-800"
          >
            Guardar alerta
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
