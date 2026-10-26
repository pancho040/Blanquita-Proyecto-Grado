import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../constants/Colors';
import { useRuta } from '../context/RutaContext';
import { HojaRutaScreen } from '../screens/Ruta/HojaRutaScreen';
import { NuevoClienteScreen } from '../screens/Clientes/NuevoClienteScreen';
import { CierreRutaScreen } from '../screens/Cierre/CierreRutaScreen';
import { SincronizacionScreen } from '../screens/Sync/SincronizacionScreen';
import { Truck, UserPlus, DollarSign, Database } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  const { syncPendientes } = useRuta();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HojaRutaTab"
        component={HojaRutaScreen}
        options={{
          tabBarLabel: 'Ruta',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="NuevoClienteTab"
        component={NuevoClienteScreen}
        options={{
          tabBarLabel: 'Nuevo',
          tabBarIcon: ({ color, size }) => <UserPlus size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CierreRutaTab"
        component={CierreRutaScreen}
        options={{
          tabBarLabel: 'Cierre',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SincronizacionTab"
        component={SincronizacionScreen}
        options={{
          tabBarLabel: 'Conexión',
          tabBarBadge: syncPendientes > 0 ? syncPendientes : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.accent,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, size }) => <Database size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
