import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LogisticaApi } from '../../api/logisticaApi';
import {
  Truck,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  X,
  AlertCircle,
  Boxes,
} from 'lucide-react-native';

export const SolicitarCargaModal = ({
  visible,
  onClose,
  idAsignacion,
  inventarioRemanente = [],
  onSolicitudExitosa,
}) => {
  const [usarRemanente, setUsarRemanente] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Lista de presentaciones disponibles (del remanente o catálogo base si remanente está vacío)
  const itemsDisponibles = useMemo(() => {
    if (inventarioRemanente && inventarioRemanente.length > 0) {
      return inventarioRemanente.map((it) => ({
        presentacion_id: it.presentacion_id || it.IdPresentacion || it.id,
        nombre: it.nombre_producto || it.nombre_presentacion || 'Producto',
        remanente: Number(it.cantidad_remanente || it.saldo_camion || it.stock_camion || 0),
        codigo: it.codigo_presentacion || '',
      }));
    }
    // Catálogo estándar de productos Blanquita Sucre/Potosí por defecto
    return [
      { presentacion_id: 1, nombre: 'Higiénico Blanquita Clásico 40m (Fardo x 40)', remanente: 0, codigo: 'HIG-CLA-40' },
      { presentacion_id: 2, nombre: 'Higiénico Blanquita Plus Doble Hoja (Fardo x 24)', remanente: 0, codigo: 'HIG-DHO-24' },
      { presentacion_id: 3, nombre: 'Servilleta Blanquita Mesa 100u (Caja x 20)', remanente: 0, codigo: 'SRV-MES-100' },
    ];
  }, [inventarioRemanente]);

  const modificarCantidad = (id, delta) => {
    setCantidades((prev) => {
      const actual = Number(prev[id] || 0);
      const nueva = Math.max(0, actual + delta);
      return { ...prev, [id]: nueva };
    });
  };

  const setCantidadDirecta = (id, texto) => {
    const val = parseInt(texto, 10);
    setCantidades((prev) => ({
      ...prev,
      [id]: isNaN(val) || val < 0 ? 0 : val,
    }));
  };

  const totalBultosSolicitados = useMemo(() => {
    return Object.values(cantidades).reduce((sum, c) => sum + Number(c || 0), 0);
  }, [cantidades]);

  const handleEnviar = async () => {
    setErrorMsg(null);

    // Si no usa remanente y no pide cantidades adicionales, avisar al chofer
    if (!usarRemanente && totalBultosSolicitados <= 0) {
      setErrorMsg('Selecciona al menos una cantidad a cargar o activa "Confirmar salida con stock remanente".');
      return;
    }

    setEnviando(true);
    try {
      const itemsPayload = Object.entries(cantidades)
        .filter(([, cant]) => Number(cant) > 0)
        .map(([id, cant]) => ({
          presentacion_id: Number(id),
          cantidad_solicitada: Number(cant),
        }));

      const payload = {
        id_asignacion: idAsignacion || 1,
        usar_remanente: usarRemanente,
        observacion: observacion.trim(),
        items: itemsPayload,
      };

      const res = await LogisticaApi.solicitarCargaCamion(payload);

      if (res.success || res.codigo === 'EXITO') {
        Alert.alert(
          'Solicitud Enviada',
          'Tu solicitud de carga ha sido remitida a Almacén/Web. Espera la confirmación del encargado para iniciar ruta.',
          [
            {
              text: 'Entendido',
              onPress: () => {
                if (onSolicitudExitosa) onSolicitudExitosa(res.data || payload);
                onClose();
              },
            },
          ]
        );
      } else {
        setErrorMsg(res.error || 'No se pudo enviar la solicitud de carga.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error inesperado al conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Encabezado */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBox}>
              <Truck size={22} color={Colors.primary} />
              <View>
                <Text style={styles.titulo}>Solicitar Carga a Almacén</Text>
                <Text style={styles.subtitulo}>Habilitación de inventario para ruta</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Opción 1: Usar Remanente del Camión */}
            <TouchableOpacity
              style={[styles.remanenteCard, usarRemanente && styles.remanenteCardActivo]}
              onPress={() => setUsarRemanente(!usarRemanente)}
              activeOpacity={0.8}
            >
              <View style={styles.remanenteHeader}>
                <Boxes size={20} color={usarRemanente ? '#0284C7' : '#64748B'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.remanenteTitulo}>
                    Confirmar salida con stock remanente
                  </Text>
                  <Text style={styles.remanenteDesc}>
                    Opera con los bultos que ya tienes a bordo en el camión sin solicitar carga física adicional a almacén.
                  </Text>
                </View>
                <View style={[styles.checkCircle, usarRemanente && styles.checkCircleActivo]}>
                  {usarRemanente && <CheckCircle2 size={18} color="#FFFFFF" />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.seccionHeader}>
              <Package size={16} color={Colors.primary} />
              <Text style={styles.seccionTitulo}>
                {usarRemanente ? 'Cantidades adicionales opcionales:' : 'Selecciona las cantidades a cargar:'}
              </Text>
            </View>

            {/* Lista de productos para solicitar carga */}
            {itemsDisponibles.map((it) => {
              const cantActual = cantidades[it.presentacion_id] || 0;
              return (
                <View key={it.presentacion_id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemNombre}>{it.nombre}</Text>
                    {it.remanente > 0 && (
                      <Text style={styles.itemRemanente}>
                        Remanente a bordo: {it.remanente} bultos
                      </Text>
                    )}
                  </View>

                  <View style={styles.contadorRow}>
                    <TouchableOpacity
                      style={[styles.btnStep, cantActual <= 0 && styles.btnStepDisabled]}
                      onPress={() => modificarCantidad(it.presentacion_id, -5)}
                      disabled={cantActual <= 0}
                      activeOpacity={0.7}
                    >
                      <Minus size={14} color={cantActual <= 0 ? '#94A3B8' : '#0F172A'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnStep, cantActual <= 0 && styles.btnStepDisabled]}
                      onPress={() => modificarCantidad(it.presentacion_id, -1)}
                      disabled={cantActual <= 0}
                      activeOpacity={0.7}
                    >
                      <Minus size={14} color={cantActual <= 0 ? '#94A3B8' : '#0F172A'} />
                    </TouchableOpacity>

                    <Input
                      value={String(cantActual)}
                      onChangeText={(val) => setCantidadDirecta(it.presentacion_id, val)}
                      keyboardType="numeric"
                      style={styles.inputCantidadContainer}
                      inputStyle={styles.inputCantidad}
                    />

                    <TouchableOpacity
                      style={styles.btnStep}
                      onPress={() => modificarCantidad(it.presentacion_id, 1)}
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color="#0F172A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnStep}
                      onPress={() => modificarCantidad(it.presentacion_id, 5)}
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Observaciones del chofer */}
            <View style={{ marginTop: 12 }}>
              <Input
                label="Observación para el encargado de almacén (opcional)"
                value={observacion}
                onChangeText={setObservacion}
                placeholder="Ej: Carga habitual de la mañana, verificar precintos"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Resumen */}
            <View style={styles.resumenBox}>
              <Text style={styles.resumenTexto}>
                Total adicional solicitado: <Text style={styles.resumenNegrita}>{totalBultosSolicitados} bultos</Text>
              </Text>
              {usarRemanente && (
                <Text style={styles.resumenSub}>
                  + Stock remanente en camión confirmado
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Botones de acción */}
          <View style={styles.footerRow}>
            <Button
              title="Cancelar"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={enviando}
            />
            <Button
              title={enviando ? 'Enviando...' : 'Enviar Solicitud'}
              icon={CheckCircle2}
              variant="primary"
              size="md"
              onPress={handleEnviar}
              loading={enviando}
              disabled={enviando || (!usarRemanente && totalBultosSolicitados <= 0)}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitulo: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  scrollBody: {
    marginVertical: 12,
    maxHeight: 460,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
  },
  remanenteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  remanenteCardActivo: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.05)',
  },
  remanenteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  remanenteTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  remanenteDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActivo: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 8,
  },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
  },
  itemRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemNombre: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemRemanente: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  contadorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnStep: {
    width: 32,
    height: 34,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStepDisabled: {
    opacity: 0.4,
  },
  inputCantidadContainer: {
    marginVertical: 0,
    width: 44,
  },
  inputCantidad: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 0,
    height: 34,
    minHeight: 34,
  },
  resumenBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  resumenTexto: {
    fontSize: 12.5,
    color: '#334155',
  },
  resumenNegrita: {
    fontWeight: '800',
    color: '#0F172A',
  },
  resumenSub: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});

export default SolicitarCargaModal;