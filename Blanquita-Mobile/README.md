# 📱 Papelera Blanquita - Aplicación Móvil para Choferes y Distribución

Aplicación móvil oficial en **React Native (Expo SDK 52)** diseñada para los repartidores y choferes de **Papelera Blanquita** en Sucre, Bolivia.

Construida bajo la arquitectura **Offline-First**, garantiza que los choferes puedan operar con total normalidad en zonas de Chuquisaca sin cobertura celular o con señal intermitente, resguardando cada transacción en almacenamiento local cifrado y sincronizándola automáticamente con el servidor FastAPI y Supabase al recuperar la conexión.

---

## 🎯 Cobertura de Historias de Usuario

| Historia de Usuario | Descripción en la App | Archivos Principales |
|---|---|---|
| **HU-27: Modo Offline** | Persistencia local completa de credenciales, hoja de ruta, paradas y catálogo en `AsyncStorage`. | [`localDb.js`](./src/database/localDb.js), [`syncQueue.js`](./src/database/syncQueue.js) |
| **HU-28: Sincronización Automática** | Detección reactiva de red (`NetInfo`) y reenvío asíncrono con cola de salida (Outbox Pattern). | [`NetworkContext.js`](./src/context/NetworkContext.js), [`syncService.js`](./src/services/syncService.js) |
| **HU-29: Nuevo Cliente en Campo** | Formulario de prospección y alta de clientes en ruta con fijación satelital GPS obligatoria. | [`NuevoClienteScreen.js`](./src/screens/Clientes/NuevoClienteScreen.js), [`clientesApi.js`](./src/api/clientesApi.js) |
| **HU-30: Hoja de Ruta Diaria** | Visualización de la secuencia óptima planificada en planta, paradas pendientes, entregadas y métricas. | [`HojaRutaScreen.js`](./src/screens/Ruta/HojaRutaScreen.js), [`ParadaCard.js`](./src/components/ruta/ParadaCard.js) |
| **HU-31: Entrega y Nota Digital** | Confirmación de fardos, descuento de inventario del camión y emisión de Nota de Entrega digital (con botón WhatsApp). | [`RegistrarEntregaScreen.js`](./src/screens/Ruta/RegistrarEntregaScreen.js), [`ComprobanteModal.js`](./src/components/ruta/ComprobanteModal.js) |
| **HU-32: Cobros Efectivo vs QR** | Registro de cobros al contado o abono a crédito, discriminando efectivo en mano vs transferencias QR. | [`RegistrarCobroScreen.js`](./src/screens/Ruta/RegistrarCobroScreen.js) |
| **HU-33: Captura GPS Obligatoria** | Georreferenciación satelital obligatoria en cada entrega, cobro y alta de cliente, más telemetría periódica. | [`LocationContext.js`](./src/context/LocationContext.js), [`Config.js`](./src/constants/Config.js) |
| **HU-34: Cierre de Ruta y Arqueo** | Cierre de jornada con arqueo de dinero en efectivo para rendición en Tesorería y odómetro final. | [`CierreRutaScreen.js`](./src/screens/Cierre/CierreRutaScreen.js) |

---

## 🏗️ Arquitectura de Carpetas

```text
Blanquita-Mobile/
├── assets/                 # Logotipos e iconos de la app
├── src/
│   ├── api/                # Clientes de red
│   │   ├── client.js       # Instancia Axios con interceptores y timeout
│   │   ├── authApi.js      # Login y credenciales
│   │   ├── logisticaApi.js # Endpoints de asignaciones, entregas, cobros y liquidación
│   │   ├── clientesApi.js  # Alta de clientes en campo
│   │   └── supabaseClient.js # Conexión a Supabase con persistencia local
│   ├── constants/          # Constantes globales
│   │   ├── Colors.js       # Paleta corporativa Blanquita
│   │   └── Config.js       # URLs, variables de entorno y parámetros GPS
│   ├── database/           # Capa de almacenamiento local
│   │   ├── localDb.js      # Gestor de base de datos local en AsyncStorage
│   │   └── syncQueue.js    # Cola outbox de transacciones pendientes
│   ├── context/            # Proveedores de estado global
│   │   ├── AuthContext.js     # Autenticación online/offline y sesión
│   │   ├── NetworkContext.js  # Escucha de red y disparo de sincronización
│   │   ├── LocationContext.js # GPS en tiempo real y telemetría periódica
│   │   └── RutaContext.js     # Estado de la hoja de ruta, entregas y cobros
│   ├── components/
│   │   ├── common/         # Componentes reutilizables (Button, Input, Card, Header, etc.)
│   │   └── ruta/           # Componentes especializados (ParadaCard, MetricasResumen, ComprobanteModal)
│   ├── screens/            # Pantallas de la aplicación
│   │   ├── Auth/           # LoginScreen
│   │   ├── Ruta/           # HojaRutaScreen, DetalleParadaScreen, RegistrarEntregaScreen, RegistrarCobroScreen
│   │   ├── Clientes/       # NuevoClienteScreen
│   │   ├── Cierre/         # CierreRutaScreen
│   │   └── Sync/           # SincronizacionScreen
│   └── navigation/         # Navegadores
│       ├── AppNavigator.js # Stack de navegación principal
│       └── TabNavigator.js # Barra de navegación inferior con badges
├── App.js                  # Entrada raíz con proveedores de contexto
├── app.json                # Metadatos de Expo y permisos de ubicación GPS
└── package.json            # Dependencias oficiales Expo SDK 52 y React Native 0.76.9
```

---

## 🛠️ Configuración de la "Aplicación de Desarrollador" (Development Build)

Al igual que en proyectos avanzados con `eas.json` y `expo-dev-client`, este proyecto está preparado para ejecutarse tanto en **Expo Go** como en una **App Nativa de Desarrollador (Development Build)**.

### ¿Por qué usar la App de Desarrollador?
1. **Acceso nativo total:** Soporta background GPS y todas las librerías nativas sin restricciones de sandbox.
2. **Menú de depuración avanzado:** Al sacudir el teléfono o pulsar con 3 dedos se despliega el Developer Menu de Expo (Fast Refresh, Element Inspector, Network Monitor).
3. **Deep Linking personalizado:** Soporta el scheme `blanquita-mobile://`.

---

## 📱 Cómo Generar el APK de Desarrollo (EAS Build)

1. **Instalar EAS CLI** (si no lo tienes instalado):
   ```powershell
   npm install -g eas-cli
   ```

2. **Iniciar sesión en Expo**:
   ```powershell
   eas login
   ```

3. **Compilar el APK de la App de Desarrollador**:
   ```powershell
   cd Blanquita-Mobile
   npm run build:dev
   ```
   *(O directamente: `eas build --profile development --platform android`)*
   
   Al finalizar, EAS te entregará un link y código QR para descargar e instalar el archivo `.apk` directamente en tu teléfono Android.

4. **Compilar un APK autónomo (Preview / Sin depender de PC)**:
   ```powershell
   npm run build:apk
   ```
   *(O: `eas build --profile preview --platform android`)*

---

## 🚀 Cómo Conectar tu Teléfono a tu PC con la App de Desarrollador

1. Abre tu terminal en la PC y ejecuta:
   ```powershell
   cd Blanquita-Mobile
   npm run start:dev
   ```
2. Asegúrate de que tu celular y tu PC estén en la misma red Wi-Fi (o usa `npx expo start --dev-client --tunnel`).
3. Abre la app **Blanquita Choferes** recién instalada en tu teléfono.
4. Presiona **Scan QR Code** y apunta a la terminal de tu computadora. ¡Listo! La app cargará el bundle directamente desde tu máquina con recarga en vivo.

---

## 🚀 Cómo Ejecutar la Aplicación en Modo Desarrollo con Expo Go

---

## 🔒 Seguridad y Privacidad
- La aplicación no almacena contraseñas en texto plano.
- Las coordenadas de ubicación se capturan únicamente con el consentimiento del usuario para respaldar las entregas comerciales de la empresa.
- Cero dependencias innecesarias de servicios de terceros fuera del ecosistema Blanquita y Supabase.
