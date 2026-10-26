import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { DetalleParadaScreen } from '../screens/Ruta/DetalleParadaScreen';
import { RegistrarEntregaScreen } from '../screens/Ruta/RegistrarEntregaScreen';
import { RegistrarCobroScreen } from '../screens/Ruta/RegistrarCobroScreen';
import { NuevoClienteScreen } from '../screens/Clientes/NuevoClienteScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.backgroundDark },
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="DetalleParada" component={DetalleParadaScreen} />
          <Stack.Screen name="RegistrarEntrega" component={RegistrarEntregaScreen} />
          <Stack.Screen name="RegistrarCobro" component={RegistrarCobroScreen} />
          <Stack.Screen name="NuevoCliente" component={NuevoClienteScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundDark,
  },
});

export default AppNavigator;
