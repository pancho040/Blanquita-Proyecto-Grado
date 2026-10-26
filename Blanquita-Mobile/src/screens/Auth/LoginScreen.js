import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Truck, Wifi, WifiOff, Lock, User, Eye, EyeOff } from 'lucide-react-native';

export const LoginScreen = () => {
  const { login, loading } = useAuth();
  const { isOnline } = useNetwork();

  const [ci, setCi] = useState('7891001');
  const [password, setPassword] = useState('Chofer123!');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!ci.trim()) {
      setErrorMessage('Ingresa tu Cédula de Identidad');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Ingresa tu contraseña');
      return;
    }

    const result = await login(ci.trim(), password);
    if (!result.success) {
      setErrorMessage(result.message || 'Error al iniciar sesión');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Estado de Red Discreto */}
          <View style={styles.statusBar}>
            <Badge
              text={isOnline ? 'Conectado' : 'Sin Señal'}
              variant={isOnline ? 'success' : 'danger'}
              icon={isOnline ? Wifi : WifiOff}
            />
          </View>

          {/* Logotipo e Identidad Institucional Papelera Blanquita */}
          <View style={styles.brandContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../../assets/LogoBlanquita.webp')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>PAPELERA BLANQUITA</Text>
            <Text style={styles.brandSubtitle}>Reparto y Distribución Sucre</Text>
          </View>

          {/* Formulario */}
          <View style={styles.formCard}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Input
              label="Cédula de Identidad"
              placeholder="Ej: 7891001"
              value={ci}
              onChangeText={(text) => {
                setCi(text);
                setErrorMessage('');
              }}
              autoCapitalize="none"
              icon={User}
              keyboardType="numeric"
            />

            <View style={styles.passwordContainer}>
              <Input
                label="Contraseña"
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
                icon={Lock}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textMuted} />
                ) : (
                  <Eye size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            <Button
              title="Iniciar Turno"
              onPress={handleLogin}
              loading={loading}
              icon={Truck}
              size="large"
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  statusBar: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0F2FE',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 66,
    height: 66,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.1,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 3,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 4,
  },
  submitBtn: {
    marginTop: 8,
  },
});

export default LoginScreen;
