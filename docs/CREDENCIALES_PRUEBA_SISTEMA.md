# Credenciales y Perfiles Oficiales de Prueba - Sistema ERP Papelera Blanquita

**Sistema Integral de Gestión (Producción, Logística, Contabilidad, RRHH y Gerencia)**  
Documento oficial actualizado con todos los perfiles de usuario por módulo y alcance territorial (Sucre, Potosí y Multisede), incluyendo perfiles con acceso granular/híbrido.

Todos los usuarios han sido sembrados y verificados mediante el script:  
`Blanquita-Backend/app/cli/seed_usuarios_todos_modulos.py`

---

## 1. Matriz General de Credenciales

> [!NOTE]  
> **Contraseña unificada para todos los usuarios de prueba:**  
> `BlanquitaOperativo2026!`  
> Todos los correos de autenticación siguen el formato sintético oficial: `<CI>@papelblanquita.invalid`.

| Módulo / Categoría | Nombre Completo | CI | Correo Interno | Rol (`IdRol`) | Sucursal Asignada | Alcance Territorial | Tipo Acceso |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **Gerencia General** | Don Osvaldo Téllez | `10369746` | `10369746@papelblanquita.invalid` | Gerente General (`3`) | Central Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Contabilidad (Sucre)** | Lic. Mateo Alejandro Morales Ramos | `8001010` | `8001010@papelblanquita.invalid` | Contador (`4`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Contabilidad (Potosí)** | Lic. Carmen Elena Vaca Guzmán | `8002010` | `8002010@papelblanquita.invalid` | Contador (`4`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Contabilidad (Multisede)**| Lic. Roberto Carlos Flores Terán | `8003010` | `8003010@papelblanquita.invalid` | Contador (`4`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Logística (Sucre)** | René Carlos Torres Alba | `8001001` | `8001001@papelblanquita.invalid` | Supervisor (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Logística (Potosí)** | Gonzalo Hugo Flores Peñaranda | `8002001` | `8002001@papelblanquita.invalid` | Supervisor (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Logística (Multisede)** | Ing. Sergio Marcelo Ramos Calvimontes | `8003020` | `8003020@papelblanquita.invalid` | Supervisor (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Reparto Móvil (Sucre)** | Ramiro Luis Gutiérrez Sosa | `8001002` | `8001002@papelblanquita.invalid` | Agente Reparto (`6`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **Reparto Móvil (Potosí 1)**| Jaime Alberto Villegas Copa | `8002002` | `8002002@papelblanquita.invalid` | Agente Reparto (`6`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **Reparto Móvil (Potosí 2)**| Milton Roxana Choque Quispe | `8002003` | `8002003@papelblanquita.invalid` | Agente Reparto (`6`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **RRHH (Sucre)** | Lic. Patricia Eugenia Morales Soliz | `8001030` | `8001030@papelblanquita.invalid` | Supervisor / Admin (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **RRHH (Potosí)** | Lic. Javier Fernando Paredes Cruz | `8002030` | `8002030@papelblanquita.invalid` | Supervisor / Admin (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **RRHH (Multisede)** | Lic. Valeria Andrea Mercado Paz | `8003030` | `8003030@papelblanquita.invalid` | Supervisor / Admin (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Híbrido Web 1 (Sucre)** | Andrea Sofía Durán Méndez | `8001040` | `8001040@papelblanquita.invalid` | Supervisor (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Híbrido Web 2 (Potosí)** | Mauricio José Alarcón Pinto | `8002040` | `8002040@papelblanquita.invalid` | Supervisor / Admin (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Híbrido Web 3 (Multisede)**| Lic. Álvaro Esteban Campero Daza | `8003040` | `8003040@papelblanquita.invalid` | Supervisor / Admin (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Híbrido Web 4 (Multisede)**| Lic. Gabriela Beatriz Salinas Rios | `8003050` | `8003050@papelblanquita.invalid` | Contador / Admin (`4`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |

---

## 2. Detalle de Permisos por Módulo y Comportamiento Esperado

### 2.1 Contabilidad & Tesorería

#### A. Contador Mono-sede Sucre (`CI: 8001010` - Mateo Alejandro Morales Ramos)
- **Sucursal:** Exclusivo Sucursal Sucre (`IdSucursal = 1`, `puede_ver_todas = false`).
- **Qué PUEDE ver y hacer:**
  * Flujo de Caja Sucre (`/contador/caja`).
  * Vales y Solicitudes de Caja Chica de Sucre (`/contador/caja-chica`).
  * Notas de Venta emitidas en camiones y ventas de Sucre (`/contador/notas-venta`).
  * Cuentas por Cobrar y Cobranzas de clientes de Sucre (`/contador/cuentas-cobrar`).
- **Qué TIENE RESTRINGIDO (Bloqueo por seguridad):**
  * `GET /contador/bancos`: Bloqueado con **HTTP 403 Forbidden** (*"La administración de cuentas bancarias es de alcance corporativo y requiere permisos multisede"*).
  * `GET /cxp/*`: Bloqueado con **HTTP 403 Forbidden** (*"Cuentas por Pagar es de alcance corporativo y requiere permisos multisede"*).
  * No puede ver cajas, cobranzas ni notas de venta de Potosí.

#### B. Contador Mono-sede Potosí (`CI: 8002010` - Carmen Elena Vaca Guzmán)
- **Sucursal:** Exclusivo Sucursal Potosí (`IdSucursal = 2`, `puede_ver_todas = false`).
- **Qué PUEDE ver y hacer:**
  * Flujo de Caja y Arqueos de la sede Potosí.
  * Caja Chica y rendiciones de Potosí.
  * Cuentas por Cobrar de Potosí y Notas de Venta asociadas a las rutas 201, 202 y 203.
- **Qué TIENE RESTRINGIDO:**
  * Bloqueo 403 en Bancos Corporativos y Cuentas por Pagar a Proveedores.
  * Aislamiento total de información de Sucre.

#### C. Contador Corporativo Multisede (`CI: 8003010` - Roberto Carlos Flores Terán)
- **Sucursal:** Ambas sedes (`puede_ver_todas = true`).
- **Qué PUEDE ver y hacer:**
  * Control y consolidación simultánea de Cajas Sucre y Cajas Potosí.
  * Administración total de Cuentas Bancarias Empresariales (`/contador/bancos`).
  * Gestión nacional de Cuentas por Pagar a Proveedores (`/contador/cuentas-pagar`).
  * Aprobación de Cobros QR y conciliación de abonos bancarios de ambas sedes.
  * Reportes financieros y de cobranza consolidados.

---

### 2.2 Logística & Distribución

#### A. Supervisor Mono-sede Sucre (`CI: 8001001` - René Carlos Torres Alba)
- **Sucursal:** Exclusivo Sucursal Sucre (`IdSucursal = 1`, `puede_ver_todas = false`).
- **Qué PUEDE ver y hacer:**
  * Trazado de rutas y asignación de despachos en Sucre (`/supervisor/rutas`, `/supervisor/asignaciones`).
  * Aprobación, observación o rechazo de solicitudes de carga de camiones en Sucre.
  * Gestión de cartera de clientes y puntos de venta de Chuquisaca.
  * Inventario comercial en almacén de Sucre (`/supervisor/inventario-comercial`).
- **Qué TIENE RESTRINGIDO:**
  * Bloqueo en consulta y asignación de rutas y pedidos de Potosí (HTTP 404/403).
  * Sin acceso a tesorería (Bancos, Caja Chica, Pagos a Proveedores).

#### B. Supervisor Mono-sede Potosí (`CI: 8002001` - Gonzalo Hugo Flores Peñaranda)
- **Sucursal:** Exclusivo Sucursal Potosí (`IdSucursal = 2`, `puede_ver_todas = false`).
- **Qué PUEDE ver y hacer:**
  * Gestión de las rutas 201 (Casco Central), 202 (Mercado Uyuni) y 203 (Satélite/Ciudadela).
  * Despacho y liquidación de carga para los choferes de Potosí (Jaime Villegas y Milton Choque).
  * Clientes y puntos de venta en el municipio de Potosí.
  * Control del stock comercial disponible en almacén de Potosí.
- **Qué TIENE RESTRINGIDO:**
  * Aislamiento territorial total de operaciones de Sucre.

#### C. Supervisor Nacional Multisede (`CI: 8003020` - Ing. Sergio Marcelo Ramos Calvimontes)
- **Sucursal:** Ambas sedes (`puede_ver_todas = true`).
- **Qué PUEDE ver y hacer:**
  * Monitoreo en tiempo real de flotas de reparto en Sucre y Potosí con selector de sede.
  * Emisión y recepción de remisiones y traslados de inventario entre sucursales (`/supervisor/envios`).
  * Configuración de listas de precios comerciales por sede (`/supervisor/precios`).
  * Reasignación de pedidos y balanceo de carga entre ambas ciudades.

#### D. Choferes Operativos en App Móvil
- **Ramiro Luis Gutiérrez Sosa (`CI: 8001002`) - Sucre:**
  * Ruta asignada: 101 - Supermercados Centro Sucre. Stock en camión disponible para venta directa.
- **Jaime Alberto Villegas Copa (`CI: 8002002`) - Potosí:**
  * Ruta asignada: 201 - Casco Central Potosí. Pedidos vinculados y stock en camión.
- **Milton Roxana Choque Quispe (`CI: 8002003`) - Potosí:**
  * Ruta asignada: 202 - Mercado Uyuni y Ferias Populares Potosí.

---

### 2.3 Recursos Humanos (RRHH & Biométrico)

#### A. Encargada de RRHH Sucre (`CI: 8001030` - Lic. Patricia Eugenia Morales Soliz)
- **Sucursal:** Exclusivo Sucursal Sucre (`IdSucursal = 1`, `puede_ver_todas = false`, `IsAdmin = true`).
- **Qué PUEDE ver y hacer:**
  * Registro y marcaciones de asistencia biométrica del personal de Sucre (`/admin/rrhh/asistencia`).
  * Cronograma de turnos de planta y logística de Sucre (`/admin/rrhh/turnos`).
  * Fichas de empleados asignados a Sucre (`/admin/rrhh/empleados`).
- **Qué TIENE RESTRINGIDO:**
  * Intentos de consulta o edición de empleados de Potosí devuelven **HTTP 404 / 403**.
  * No tiene acceso a la pantalla de roles y usuarios de seguridad (`/admin/roles` redirige automáticamente).

#### B. Encargado de RRHH Potosí (`CI: 8002030` - Lic. Javier Fernando Paredes Cruz)
- **Sucursal:** Exclusivo Sucursal Potosí (`IdSucursal = 2`, `puede_ver_todas = false`, `IsAdmin = true`).
- **Qué PUEDE ver y hacer:**
  * Marcaciones biométricas, atrasos y horas extra de empleados de Potosí.
  * Turnos operativos de la sede Potosí.
  * Altas y actualización de datos de trabajadores de Potosí.
- **Qué TIENE RESTRINGIDO:**
  * Datos y marcaciones de Sucre.
  * Módulo de Roles y Seguridad del sistema.

#### C. Jefe Nacional de RRHH Multisede (`CI: 8003030` - Lic. Valeria Andrea Mercado Paz)
- **Sucursal:** Ambas sedes (`puede_ver_todas = true`, `IsAdmin = true`).
- **Qué PUEDE ver y hacer:**
  * Dashboard General de Recursos Humanos nacional (`/admin/rrhh/inicio`).
  * Generación y cálculo de Planillas Salariales de Sucre y Potosí (`/admin/rrhh/planillas`).
  * Liquidación de Finiquitos e indemnizaciones laborales.
  * Parámetros laborales legales (SMN, aporte AFP, días laborables mes en `/admin/rrhh/configuracion`).
  * Reportes consolidados de ausentismo y masa salarial de la empresa.

---

### 2.4 Usuarios Web de Prueba con Acceso Parcial / Híbrido

Perfiles diseñados específicamente para validar que los límites de navegación y autorización funcionan de manera granular (accediendo a partes seleccionadas de un módulo y teniendo bloqueadas otras):

#### A. Híbrido 1: Auxiliar de Despacho y Cobranzas Sucre (`CI: 8001040` - Andrea Sofía Durán Méndez)
- **Perfil Funcional:** Coordina las salidas de almacén y cuadra las notas de venta cobradas en el día en Sucre.
- **Sucursal:** Exclusivo Sucre (`IdSucursal = 1`, `puede_ver_todas = false`).
- **Acceso Permitido:**
  * **Logística (Parcial):** Puede consultar clientes, monitorear despachos (`/supervisor/asignaciones`) y verificar el inventario comercial (`/supervisor/inventario-comercial`).
  * **Contabilidad (Parcial):** Puede ingresar a Notas de Venta (`/cxc/notas-venta`) y validar saldos de clientes (`/cxc/cuentas-cobrar`).
- **Acceso Denegado:**
  * **Contabilidad:** Sin acceso a Flujo de Caja (`/contador/caja`), Cuentas Bancarias ni Cuentas por Pagar (HTTP 403).
  * **Logística:** No puede modificar tarifas base ni crear zonas.
  * **RRHH:** Sin acceso al módulo de personal.

#### B. Híbrido 2: Auxiliar Operativo y Asistencia Potosí (`CI: 8002040` - Mauricio José Alarcón Pinto)
- **Perfil Funcional:** Monitorea la ejecución de rutas en Potosí y controla la asistencia diaria del personal operativo local.
- **Sucursal:** Exclusivo Potosí (`IdSucursal = 2`, `puede_ver_todas = false`).
- **Acceso Permitido:**
  * **Logística (Parcial):** Visualización del trazado de Rutas en Potosí (`/supervisor/rutas`).
  * **RRHH (Parcial):** Acceso al Control de Asistencia diaria (`/admin/rrhh/asistencia`) y Cronograma de Turnos (`/admin/rrhh/turnos`) de los trabajadores de Potosí.
- **Acceso Denegado:**
  * **RRHH:** Bloqueado acceso a Planillas salariales confidenciales, finiquitos y configuración de aportes.
  * **Contabilidad:** Sin acceso a Tesorería, Cajas ni Facturación.
  * **Territorial:** Sin acceso a registros de Sucre.

#### C. Híbrido 3: Auditor de Operaciones Multisede (`CI: 8003040` - Lic. Álvaro Esteban Campero Daza)
- **Perfil Funcional:** Auditor interno con visibilidad transversal para fiscalizar despachos, arqueos y cumplimiento de turnos en ambas ciudades sin facultades de ejecución contable ni cambio de salarios.
- **Sucursal:** Multisede Sucre y Potosí (`puede_ver_todas = true`, `IsAdmin = true`).
- **Acceso Permitido:**
  * **Contabilidad (Parcial):** Consulta y fiscalización de Notas de Venta, Arqueos de Caja y Carteras de Crédito en Sucre y Potosí.
  * **Logística (Parcial):** Supervisión de Asignaciones de Reparto, Mermas registradas en envíos e Inventario físico de ambas sucursales.
  * **RRHH (Parcial):** Auditoría de asistencia biométrica, tardanzas y horas extra reportadas en ambas sedes.
- **Acceso Denegado:**
  * **Contabilidad:** No puede registrar pagos a proveedores ni autorizar transferencias de cuentas bancarias.
  * **RRHH:** No puede modificar sueldos básicos ni alterar finiquitos legales.
  * **Seguridad:** Bloqueada la alteración de roles de usuario (`/admin/roles`).

#### D. Híbrido 4: Auxiliar de Tesorería y Personal Multisede (`CI: 8003050` - Lic. Gabriela Beatriz Salinas Rios)
- **Perfil Funcional:** Apoyo administrativo en flujo de caja chica y revisión de turnos del personal en ambas sedes.
- **Sucursal:** Multisede Sucre y Potosí (`puede_ver_todas = true`, `IsAdmin = true`).
- **Acceso Permitido:**
  * **Contabilidad (Parcial):** Flujo de Caja y recepción de solicitudes de Vales de Caja Chica (`/contador/caja`, `/contador/caja-chica`).
  * **RRHH (Parcial):** Consulta de Cronograma de Turnos y listado de empleados para cotejo de firmas.
  * **Logística (Parcial):** Consulta de listas de precios vigentes.
- **Acceso Denegado:**
  * **Logística:** Sin facultades para crear hojas de ruta, aprobar cargas o despachar camiones.
  * **RRHH:** Sin acceso a planillas salariales ni finiquitos.
  * **Contabilidad:** Sin acceso a pagos de Cuentas por Pagar ni modificación de cuentas bancarias.

---

## 3. Endpoints de Verificación de Login

### A. Login Web (Portal del Sistema)
- **URL:** `POST /auth/login` (o mediante formulario web en `http://localhost:4321/`)
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo JSON:**
  ```json
  {
    "Ci": "<CI_USUARIO>",
    "Clave": "BlanquitaOperativo2026!"
  }
  ```
- **Respuesta Exitosa (HTTP 200):**
  ```json
  {
    "AccessToken": "<JWT_TOKEN>",
    "RefreshToken": "<REFRESH_TOKEN>",
    "TokenType": "bearer"
  }
  ```

### B. Login Móvil (App Repartidores)
- **URL:** `POST /api/movil/v1/auth/login`
- **Cuerpo JSON:**
  ```json
  {
    "Ci": "<CI_CHOFER>",
    "Clave": "BlanquitaOperativo2026!"
  }
  ```
- **Respuesta Exitosa (HTTP 200):**
  Devuelve tokens y el objeto `usuario` con su alcance territorial (`sucursales_permitidas: [1]` o `[2]`, `puede_ver_todas: false`).

---

## 4. Instrucciones de Re-ejecución Idempotente

El script de sembrado es seguro, no borra datos productivos y puede re-ejecutarse en cualquier momento:

```bash
# Simulación sin alterar la base de datos:
cd Blanquita-Backend && .\.venv\Scripts\python.exe app/cli/seed_usuarios_todos_modulos.py --dry-run

# Ejecución real:
cd Blanquita-Backend && .\.venv\Scripts\python.exe app/cli/seed_usuarios_todos_modulos.py
```
