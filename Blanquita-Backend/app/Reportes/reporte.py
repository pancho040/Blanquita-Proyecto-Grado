import io
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.utils.dates import date_formatter
Columna = tuple[str, str | Callable]

RUTA_LOGO = Path(__file__).with_name("LogoBlanquita.webp")

_logo_cache: ImageReader | None = None
_logo_cargado = False


def _obtener_logo() -> ImageReader | None:
    """Carga el logo una sola vez. Si no existe o falla, el reporte sale sin él."""
    global _logo_cache, _logo_cargado
    if not _logo_cargado:
        _logo_cargado = True
        try:
            if RUTA_LOGO.exists():
                _logo_cache = ImageReader(str(RUTA_LOGO))
        except Exception:
            _logo_cache = None
    return _logo_cache


class Reporte:
    EMPRESA = "Papel Blanquita"
    MARGEN = 2 * cm
    ALTO_ENCABEZADO = 2.6 * cm
    ALTO_LOGO = 1.5 * cm
    FUENTE_DERECHA = 9
    INTERLINEA_DERECHA = 0.42 * cm
    Y_PRIMER_FILTRO = 1.0 * cm
    Y_MINIMO_GENERADO_POR = 1.9 * cm
    SEPARACION_GENERADO_POR = 0.5 * cm
    ESPACIO_BAJO_ENCABEZADO = 0.7 * cm
    PROPORCION_ANCHO_FILTROS = 0.55

    COLOR_PRIMARIO = colors.HexColor("#1f4e79")
    COLOR_FILA_ALTERNA = colors.HexColor("#f2f6fb")
    COLOR_TOTAL = colors.HexColor("#dce6f1")
    COLOR_BORDE = colors.HexColor("#b0b0b0")

    def __init__(
        self,
        titulo: str,
        subtitulo: str | None = None,
        filtros: dict[str, str] | None = None,
        generado_en: datetime | None = None,
        generado_por: str | None = None,
        tamanio_hoja=letter,
    ):
        self.titulo = titulo
        self.subtitulo = subtitulo
        self.filtros = filtros or {}
        self.generado_en = generado_en or datetime.now()
        self.generado_por = generado_por
        self.tamanio_hoja = tamanio_hoja

        estilos = getSampleStyleSheet()
        self._estilo_seccion = ParagraphStyle(
            "ReporteSeccion",
            parent=estilos["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=self.COLOR_PRIMARIO,
            spaceBefore=10,
            spaceAfter=4,
        )
        self._estilo_parrafo = ParagraphStyle(
            "ReporteParrafo", parent=estilos["Normal"], fontSize=9, leading=12
        )
        self._estilo_celda = ParagraphStyle(
            "ReporteCelda", fontName="Helvetica", fontSize=8, leading=10
        )
        self._estilo_celda_numero = ParagraphStyle(
            "ReporteCeldaNumero", parent=self._estilo_celda, alignment=TA_RIGHT
        )
        self._estilo_celda_encabezado = ParagraphStyle(
            "ReporteCeldaEncabezado",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
        )

        self._contenido: list = []
        self._lineas_filtros = self._partir_filtros()
        self._y_generado_por = max(
            self.Y_MINIMO_GENERADO_POR,
            self.Y_PRIMER_FILTRO
            + (len(self._lineas_filtros) - 1) * self.INTERLINEA_DERECHA
            + self.SEPARACION_GENERADO_POR,
        )
        self._alto_encabezado = max(
            self.ALTO_ENCABEZADO, self._y_generado_por + self.ESPACIO_BAJO_ENCABEZADO
        )

    def _partir_filtros(self) -> list[str]:
        ancho_maximo = (
            self.tamanio_hoja[0] - 2 * self.MARGEN
        ) * self.PROPORCION_ANCHO_FILTROS
        separador = "   |   "
        lineas: list[str] = []
        actual = ""
        for clave, valor in self.filtros.items():
            item = f"{clave}: {valor}"
            candidata = f"{actual}{separador}{item}" if actual else item
            if actual and stringWidth(candidata, "Helvetica", self.FUENTE_DERECHA) > ancho_maximo:
                lineas.append(actual)
                actual = item
            else:
                actual = candidata
        if actual:
            lineas.append(actual)
        return lineas
    def titulo_seccion(self, texto: str) -> "Reporte":
        self._contenido.append(Paragraph(escape(texto), self._estilo_seccion))
        return self

    def parrafo(self, texto: str) -> "Reporte":
        self._contenido.append(Paragraph(escape(texto), self._estilo_parrafo))
        return self

    def salto(self, alto: float = 0.4 * cm) -> "Reporte":
        self._contenido.append(Spacer(1, alto))
        return self

    def celda_multilinea(self, lineas: list[str]) -> Paragraph:
        """Arma una celda de tabla con varias líneas (una por elemento de
        `lineas`, vacíos se omiten), para usar como valor de retorno de un
        accessor callable en `tabla()`."""
        texto = "<br/>".join(escape(str(linea)) for linea in lineas if linea)
        return Paragraph(texto, self._estilo_celda)

    def tabla(
        self,
        columnas: list[Columna],
        filas: list,
        fila_total: list | None = None,
        anchos: list[float] | None = None,
    ) -> "Reporte":
        encabezados = [
            Paragraph(escape(str(titulo)), self._estilo_celda_encabezado)
            for titulo, _ in columnas
        ]
        datos: list[list] = [encabezados]

        for fila in filas:
            datos.append(
                [self._celda(self._valor(fila, accessor)) for _, accessor in columnas]
            )

        if fila_total is not None:
            datos.append([self._celda(valor) for valor in fila_total])

        tabla = Table(datos, colWidths=anchos, repeatRows=1, hAlign="LEFT")
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), self.COLOR_PRIMARIO),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.4, self.COLOR_BORDE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, self.COLOR_FILA_ALTERNA]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        if fila_total is not None:
            estilo.append(("BACKGROUND", (0, -1), (-1, -1), self.COLOR_TOTAL))
            estilo.append(("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"))
        tabla.setStyle(TableStyle(estilo))

        self._contenido.append(tabla)
        return self
    def a_pdf(self) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.tamanio_hoja,
            leftMargin=self.MARGEN,
            rightMargin=self.MARGEN,
            topMargin=self.MARGEN + self._alto_encabezado,
            bottomMargin=self.MARGEN,
            title=self.titulo,
            author=self.EMPRESA,
        )

        reporte = self

        class _CanvasNumerado(canvas.Canvas):
            """Difiere el guardado de cada página para conocer el total y pintar
            el encabezado/pie con 'Página N de M'."""

            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._paginas: list[dict] = []

            def showPage(self):
                self._paginas.append(dict(self.__dict__))
                self._startPage()

            def save(self):
                total = len(self._paginas)
                for numero, estado in enumerate(self._paginas, start=1):
                    self.__dict__.update(estado)
                    reporte._dibujar_encabezado_pie(self, numero, total)
                    super().showPage()
                super().save()

        doc.build(self._contenido or [Spacer(1, 1)], canvasmaker=_CanvasNumerado)
        return buffer.getvalue()
    def _dibujar_encabezado_pie(self, lienzo, numero_pagina: int, total_paginas: int) -> None:
        ancho, alto = self.tamanio_hoja
        tope = alto - self.MARGEN
        lienzo.saveState()

        x_texto = self.MARGEN
        logo = _obtener_logo()
        if logo is not None:
            ancho_logo, alto_logo = logo.getSize()
            ancho_dibujo = self.ALTO_LOGO * (ancho_logo / alto_logo)
            lienzo.drawImage(
                logo,
                self.MARGEN,
                tope - self.ALTO_LOGO,
                width=ancho_dibujo,
                height=self.ALTO_LOGO,
                mask="auto",
                preserveAspectRatio=True,
            )
            x_texto = self.MARGEN + ancho_dibujo + 0.35 * cm

        texto_generado = f"Generado: {date_formatter(self.generado_en)}"
        ancho_columna_derecha = lienzo.stringWidth(
            texto_generado, "Helvetica", self.FUENTE_DERECHA
        )
        ancho_disponible_titulo = (
            ancho - self.MARGEN - ancho_columna_derecha - 0.5 * cm
        ) - x_texto

        fuente_titulo = 14
        while (
            fuente_titulo > 9
            and lienzo.stringWidth(self.titulo, "Helvetica-Bold", fuente_titulo)
            > ancho_disponible_titulo
        ):
            fuente_titulo -= 0.5

        lienzo.setFillColor(self.COLOR_PRIMARIO)
        lienzo.setFont("Helvetica-Bold", fuente_titulo)
        lienzo.drawString(x_texto, tope - 0.4 * cm, self.titulo)

        lienzo.setFillColor(colors.black)
        lienzo.setFont("Helvetica", 9)
        lienzo.drawString(x_texto, tope - 1.0 * cm, self.EMPRESA)
        if self.subtitulo:
            lienzo.drawString(x_texto, tope - 1.45 * cm, self.subtitulo)

        lienzo.setFont("Helvetica", self.FUENTE_DERECHA)
        lienzo.drawRightString(ancho - self.MARGEN, tope - 0.4 * cm, texto_generado)
        for indice, linea in enumerate(self._lineas_filtros):
            lienzo.drawRightString(
                ancho - self.MARGEN,
                tope - self.Y_PRIMER_FILTRO - indice * self.INTERLINEA_DERECHA,
                linea,
            )
        if self.generado_por:
            lienzo.drawRightString(
                ancho - self.MARGEN,
                tope - self._y_generado_por,
                f"Generado por: {self.generado_por}",
            )

        linea_y = alto - self.MARGEN - self._alto_encabezado + 0.35 * cm
        lienzo.setStrokeColor(self.COLOR_BORDE)
        lienzo.line(self.MARGEN, linea_y, ancho - self.MARGEN, linea_y)

        lienzo.setFillColor(colors.black)
        lienzo.setFont("Helvetica", 8)
        lienzo.drawRightString(
            ancho - self.MARGEN,
            self.MARGEN - 0.6 * cm,
            f"Página {numero_pagina} de {total_paginas}",
        )

        lienzo.restoreState()

    def _valor(self, fila, accessor):
        if callable(accessor):
            return accessor(fila)
        if isinstance(fila, dict):
            return fila.get(accessor)
        return getattr(fila, accessor, None)

    def _celda(self, valor) -> Paragraph:
        if isinstance(valor, Paragraph):
            return valor
        texto, es_numero = self._formatear(valor)
        estilo = self._estilo_celda_numero if es_numero else self._estilo_celda
        return Paragraph(escape(texto), estilo)

    @staticmethod
    def _formatear(valor) -> tuple[str, bool]:
        if valor is None or valor == "":
            return "-", False
        if isinstance(valor, bool):
            return ("Sí" if valor else "No"), False
        if isinstance(valor, (Decimal, float)):
            formateado = f"{float(valor):,.2f}"
            return formateado.replace(",", "X").replace(".", ",").replace("X", "."), True
        if isinstance(valor, int):
            return f"{valor:,}".replace(",", "."), True
        if isinstance(valor, datetime):
            return date_formatter(valor), False
        if isinstance(valor, date):
            return valor.strftime("%d/%m/%Y"), False
        return str(valor), False
