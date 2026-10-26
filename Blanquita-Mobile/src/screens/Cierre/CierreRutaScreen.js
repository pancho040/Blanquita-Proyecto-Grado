import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  Banknote,
  QrCode,
  CheckCircle2,
  Gauge,
  Wallet,
} from 'lucide-react-native';

export const CierreRutaScreen = ({ navigation }) => {
  const { metricas, cerrarRuta } = useRuta();

  const [odometroFinal, setOdometroFinal] = useState('');
  const [loading, setLoading] = useState(false);

  const efectivo = Number(metricas?.total_efectivo || 0);
  const qr = Number(metricas?.total_qr || 0);
  const totalRecaudado = efectivo + qr;

  const handleCerrarJornada = async () => {
    if (metricas.pendientes > 0) {
      Alert.alert(
        'Paradas Pendientes',
        `Tienes ${metricas.pendientes} paradas sin entregar. ¿Deseas cerrar el turno ahora?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sí, Cerrar Turno', onPress: procederCierre },
        ]
      );
    } else {
      procederCierre();
    }
  };

  const procederCierre = async () => {
    setLoading(true);

    const datosCierre = {
      odometro_final: parseFloat(odometroFinal) || null,
      total_efectivo: efectivo,
      total_qr: qr,
      total_recaudado: totalRecaudado,
      observaciones: 'Cierre de ruta regular',
    };

    const resultado = await cerrarRuta(datosCierre);
    setLoading(false);

    if (resultado.success) {
      Alert.alert(
        'Turno Cerrado',
        `Has cerrado la jornada. Efectivo a entregar en tesorería: Bs. ${efectivo.toFixed(2)}.`,
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.navigate('HojaRutaTab'),
          },
        ]
      );
    } else {
      Alert.alert('Error', resultado.message || 'No se pudo liquidar la ruta.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Cierre de Turno" subtitle="Arqueo de Caja" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Resumen Rápido de Entregas */}
        <View style={styles.resumenEntregasCard}>
          <View style={styles.entregaStat}>
            <Text style={styles.statNumero}>{metricas?.total_paradas || 0}</Text>
            <Text style={styles.statLabel}>Total Paradas</Text>
          </View>
          <View style={styles.dividerV} />
          <View style={styles.entregaStat}>
            <Text style={[styles.statNumero, { color: Colors.success }]}>
              {metricas?.entregados || 0}
            </Text>
            <Text style={styles.statLabel}>Entregadas</Text>
          </View>
          <View style={styles.dividerV} />
          <View style={styles.entregaStat}>
            <Text
              style={[
                styles.statNumero,
                { color: metricas?.pendientes > 0 ? Colors.warning : Colors.textMuted },
              ]}
            >
              {metricas?.pendientes || 0}
            </Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Tarjeta de Arqueo de Dinero */}
        <View style={styles.arqueoCard}>
          <Text style={styles.arqueoHeader}>Arqueo de Recaudación</Text>

          {/* Efectivo en Mano */}
          <View style={styles.arqueoFila}>
            <View style={styles.iconBoxVerde}>
              <Banknote size={24} color={Colors.success} />
            </View>
            <View style={styles.arqueoInfo}>
              <Text style={styles.arqueoTitulo}>Efectivo en Mano</Text>
              <Text style={styles.arqueoSub}>Billetes para entregar a caja</Text>
            </View>
            <Text style={styles.montoVerde}>Bs. {efectivo.toFixed(2)}</Text>
          </View>

          {/* Cobros QR */}
          <View style={styles.arqueoFila}>
            <View style={styles.iconBoxAzul}>
              <QrCode size={24} color={Colors.secondary} />
            </View>
            <View style={styles.arqueoInfo}>
              <Text style={styles.arqueoTitulo}>Cobros por QR</Text>
              <Text style={styles.arqueoSub}>Acreditados en cuenta bancaria</Text>
            </View>
            <Text style={styles.montoAzul}>Bs. {qr.toFixed(2)}</Text>
          </View>

          {/* Total del Día */}
          <View style={styles.totalCierreBox}>
            <Text style={styles.totalCierreLabel}>TOTAL COBRADO HOY:</Text>
            <Text style={styles.totalCierreValor}>
              Bs. {totalRecaudado.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Kilometraje Final */}
        <View style={styles.kmCard}>
          <Input
            label="Kilometraje Final (Km)"
            placeholder="Ej: 142850"
            value={odometroFinal}
            onChangeText={setOdometroFinal}
            keyboardType="numeric"
            icon={Gauge}
          />
        </View>

        {/* Botón de Cierre Gigante y Claro */}
        <Button
          title="FINALIZAR TURNO"
          icon={CheckCircle2}
          variant="primary"
          size="large"
          loading={loading}
          onPress={handleCerrarJornada}
          style={styles.submitBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    padding: 14,
    paddingBottom: 30,
  },
  resumenEntregasCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  entregaStat: {
    alignItems: 'center',
  },
  statNumero: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dividerV: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  arqueoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  arqueoHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  arqueoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  iconBoxVerde: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBoxAzul: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  arqueoInfo: {
    flex: 1,
  },
  arqueoTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  arqueoSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  montoVerde: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.success,
  },
  montoAzul: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.secondary,
  },
  totalCierreBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  totalCierreLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  totalCierreValor: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.secondary,
    marginTop: 2,
  },
  kmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  submitBtn: {
    marginTop: 4,
  },
});

export default CierreRutaScreen;
