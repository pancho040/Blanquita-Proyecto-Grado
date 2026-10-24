import { cn } from "@/lib/utils";
import { EstadosMateriaPrima } from "@/constants/Estados";
import { useReporte } from "@/hooks/useReporte";
import {
  TarjetaFiltros,
  BotonInforme,
  BuscadorFiltro,
  FiltroProveedor,
  SelectFiltro,
  FiltroTipos,
  ResultadosReporte,
} from "@/components/Reportes/comunes";

export default function ReporteInventario({
  consultar,
  elementos,
  codigo,
  estados = EstadosMateriaPrima,
  tipo,
  informe,
  resumen,
  ...resultados
}) {
  const reporte = useReporte(
    consultar,
    {
      [codigo.campo]: "",
      IdProveedor: "",
      [tipo.campo]: tipo.unico ? "" : [],
      IdEstadoMateriaPrima: "",
    },
    [codigo.campo],
  );
  const lista = reporte.catalogo ? elementos(reporte.catalogo) : undefined;

  const tiposSeleccionados = () => {
    const valor = reporte.filtros[tipo.campo];
    const ids = Array.isArray(valor) ? valor : valor ? [valor] : [];
    return ids.length ? ids : null;
  };

  return (
    <>
      <TarjetaFiltros
        reporte={reporte}
        informe={
          informe && (
            <BotonInforme
              ayuda={informe.ayuda}
              exito="Informe de inventario descargado"
              descargar={() => informe.descargar(tiposSeleccionados())}
            />
          )
        }
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            tipo.unico ? "md:grid-cols-4" : "md:grid-cols-3",
          )}
        >
          <BuscadorFiltro
            reporte={reporte}
            campo={codigo.campo}
            etiqueta={codigo.etiqueta}
            placeholder={codigo.placeholder}
            codigo
          />
          <FiltroProveedor reporte={reporte} />
          <SelectFiltro
            reporte={reporte}
            campo="IdEstadoMateriaPrima"
            etiqueta="Estado"
            opciones={estados}
            campoEtiqueta="TipoEstado"
            placeholder="Todos los estados"
          />
          {tipo.unico && <FiltroTipos reporte={reporte} tipo={tipo} />}
        </div>

        {!tipo.unico && <FiltroTipos reporte={reporte} tipo={tipo} />}
      </TarjetaFiltros>

      <ResultadosReporte
        reporte={reporte}
        elementos={lista}
        resumen={resumen && lista && resumen(lista)}
        {...resultados}
      />
    </>
  );
}
