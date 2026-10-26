import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { CheckCircle2, Share2, X, MapPin, Calendar, Clock, Hash } from "lucide-react-native";
import { COLORS } from "../../constants/Colors";
import Button from "../common/Button";

export const ComprobanteModal = ({ visible, onClose, comprobante }) => {
  if (!comprobante) return null;

  const compartirNota = async () => {
    try {
      const productosTexto = (comprobante.productos || [])
        .map((p) => `• ${p.Nombre || p.nombre}: ${p.Cantidad || p.cantidad} fardos x Bs. ${Number(p.PrecioUnitario || p.precioUnitario || 0).toFixed(2)} = Bs. ${(Number(p.Cantidad || p.cantidad) * Number(p.PrecioUnitario || p.precioUnitario || 0)).toFixed(2)}`)
        .join("\n");

      const mensaje = `*PAPELERA BLANQUITA - NOTA DE ENTREGA*\n` +
        `Comprobante: *${comprobante.numeroNota}*\n` +
        `Fecha: ${new Date(comprobante.fechaHoraEntrega).toLocaleString()}\n` +
        `Cliente: ${comprobante.cliente || "Cliente"}\n` +
        `Punto: ${comprobante.puntoVenta || "Punto de Venta"}\n\n` +
        `*Detalle de Entrega:*\n${productosTexto}\n\n` +
        `*Total Fardos:* ${comprobante.fardosTotales}\n` +
        `*Total Importe:* Bs. ${Number(comprobante.montoTotal || 0).toFixed(2)}\n\n` +
        `GPS Certificado: ${comprobante.gps?.latitud}, ${comprobante.gps?.longitud}\n` +
        `_Emitido desde Blanquita Choferes App_`;

      await Share.share({ message: mensaje });
    } catch (e) {
      console.error("Error compartiendo nota:", e);
    }
  };

  const calcularTotalImporte = () => {
    return (comprobante.productos || []).reduce((sum, p) => {
      const cant = Number(p.Cantidad || p.cantidad || 0);
      const precio = Number(p.PrecioUnitario || p.precioUnitario || 0);
      return sum + cant * precio;
    }, 0);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Encabezado del Comprobante */}
          <View style={styles.header}>
            <View style={styles.iconoExito}>
              <CheckCircle2 size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empresaNombre}>PAPELERA BLANQUITA S.R.L.</Text>
              <Text style={styles.comprobanteTitulo}>Comprobante de Entrega</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Número y Fecha */}
            <View style={styles.infoFila}>
              <View style={styles.infoCol}>
                <Text style={styles.infoEtiqueta}>Nº NOTA</Text>
                <Text style={styles.infoValorHighlight}>{comprobante.numeroNota}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoEtiqueta}>FECHA Y HORA</Text>
                <Text style={styles.infoValor}>
                  {new Date(comprobante.fechaHoraEntrega || Date.now()).toLocaleDateString()}{" "}
                  {new Date(comprobante.fechaHoraEntrega || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>

            {/* Datos del Cliente */}
            <View style={styles.seccionCliente}>
              <Text style={styles.seccionTitulo}>CLIENTE RECEPTOR</Text>
              <Text style={styles.clienteNombre}>{comprobante.cliente || "Cliente"}</Text>
              <Text style={styles.puntoNombre}>{comprobante.puntoVenta || "Punto de Venta"}</Text>
              {comprobante.direccion ? (
                <Text style={styles.clienteDireccion}>Dir: {comprobante.direccion}</Text>
              ) : null}
            </View>

            {/* Detalle de Productos */}
            <View style={styles.seccionProductos}>
              <Text style={styles.seccionTitulo}>PRODUCTOS ENTREGADOS</Text>
              {(comprobante.productos || []).map((item, idx) => {
                const subtotal = Number(item.Cantidad || item.cantidad || 0) * Number(item.PrecioUnitario || item.precioUnitario || 0);
                return (
                  <View key={idx} style={styles.productoFila}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prodNombre}>{item.Nombre || item.nombre}</Text>
                      <Text style={styles.prodDetalle}>
                        {item.Cantidad || item.cantidad} fardos × Bs. {Number(item.PrecioUnitario || item.precioUnitario || 0).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.prodSubtotal}>Bs. {subtotal.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Totales */}
            <View style={styles.totalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Fardos:</Text>
                <Text style={styles.totalValor}>{comprobante.fardosTotales} fardos</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 4 }]}>
                <Text style={styles.totalImporteLabel}>Importe Total:</Text>
                <Text style={styles.totalImporteValor}>Bs. {calcularTotalImporte().toFixed(2)}</Text>
              </View>
            </View>

            {/* Coordenadas GPS de Entrega */}
            {comprobante.gps && (
              <View style={styles.gpsCertificado}>
                <MapPin size={13} color={COLORS.primaryDark} style={{ marginRight: 5 }} />
                <Text style={styles.gpsTexto}>
                  GPS: Lat {comprobante.gps.latitud}, Lng {comprobante.gps.longitud} (Precisión: {comprobante.gps.precision || 5}m)
                </Text>
              </View>
            )}

            {comprobante.recibidoPor ? (
              <Text style={styles.recibidoTexto}>
                Recibido por: <Text style={{ fontWeight: "700" }}>{comprobante.recibidoPor}</Text>
              </Text>
            ) : null}
          </ScrollView>

          {/* Botones de Pie */}
          <View style={styles.footerBtns}>
            <Button
              title="Compartir Comprobante"
              icon={Share2}
              onPress={compartirNota}
              variant="primary"
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Cerrar"
              onPress={onClose}
              variant="outline"
              style={{ minWidth: 90 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxHeight: "88%",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
    marginBottom: 12,
  },
  iconoExito: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  empresaNombre: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  comprobanteTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    marginBottom: 14,
  },
  infoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoEtiqueta: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  infoValorHighlight: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primaryDark,
    marginTop: 2,
  },
  infoValor: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  seccionCliente: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
    marginBottom: 10,
  },
  seccionTitulo: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clienteNombre: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  puntoNombre: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  clienteDireccion: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  seccionProductos: {
    marginBottom: 12,
  },
  productoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  prodNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  prodDetalle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  prodSubtotal: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  totalBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
  },
  totalValor: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "800",
  },
  totalImporteLabel: {
    fontSize: 14,
    color: "#15803D",
    fontWeight: "800",
  },
  totalImporteValor: {
    fontSize: 17,
    color: "#15803D",
    fontWeight: "900",
  },
  gpsCertificado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  gpsTexto: {
    fontSize: 10,
    color: COLORS.primaryDark,
    fontWeight: "600",
    flex: 1,
  },
  recibidoTexto: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  footerBtns: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default ComprobanteModal;
