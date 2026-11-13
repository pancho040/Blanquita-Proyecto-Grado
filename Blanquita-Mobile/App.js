import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { NetworkProvider } from './src/context/NetworkContext';
import { LocationProvider } from './src/context/LocationContext';
import { AuthProvider } from './src/context/AuthContext';
import { RutaProvider } from './src/context/RutaContext';
import { NotificacionesProvider } from './src/context/NotificacionesContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ActualizacionRequeridaModal } from './src/components/common/ActualizacionRequeridaModal';
import { InAppNotificationBanner } from './src/components/common/InAppNotificationBanner';
import { Colors } from './src/constants/Colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.backgroundDark}
        translucent={false}
      />
      <NavigationContainer>
        <NetworkProvider>
          <LocationProvider>
            <AuthProvider>
              <NotificacionesProvider>
                <RutaProvider>
                  <AppNavigator />
                  <ActualizacionRequeridaModal />
                  <InAppNotificationBanner />
                </RutaProvider>
              </NotificacionesProvider>
            </AuthProvider>
          </LocationProvider>
        </NetworkProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
