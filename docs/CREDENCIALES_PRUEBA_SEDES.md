# Credenciales Oficiales de Prueba - Sistema ERP Papelera Blanquita

> [!NOTE]
> Este documento ha sido actualizado y expandido formalmente con todos los módulos y perfiles de prueba en [CREDENCIALES_PRUEBA_SISTEMA.md](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/docs/CREDENCIALES_PRUEBA_SISTEMA.md).
> Ambos archivos se mantienen sincronizados.
> Contraseña unificada para todos los usuarios de prueba: `BlanquitaOperativo2026!`

---

## 1. Tabla Oficial de Credenciales de Prueba por Módulo

| Módulo / Categoría | Nombre Completo | CI | Correo Interno | Contraseña | Rol | Sucursal Asignada | Alcance Territorial | Tipo de Acceso |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Gerencia General** | Don Osvaldo Téllez | `10369746` | `10369746@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Gerente General (`3`) | Central Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Contabilidad (Sucre)** | Lic. Mateo Alejandro Morales Ramos | `8001010` | `8001010@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Contador (`4`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Contabilidad (Potosí)** | Lic. Carmen Elena Vaca Guzmán | `8002010` | `8002010@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Contador (`4`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Contabilidad (Multisede)**| Lic. Roberto Carlos Flores Terán | `8003010` | `8003010@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Contador (`4`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Logística (Sucre)** | René Carlos Torres Alba | `8001001` | `8001001@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Logística (Potosí)** | Gonzalo Hugo Flores Peñaranda | `8002001` | `8002001@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Logística (Multisede)** | Ing. Sergio Marcelo Ramos Calvimontes | `8003020` | `8003020@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Reparto Móvil (Sucre)** | Ramiro Luis Gutiérrez Sosa | `8001002` | `8001002@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Agente de Reparto (`6`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **Reparto Móvil (Potosí 1)**| Jaime Alberto Villegas Copa | `8002002` | `8002002@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Agente de Reparto (`6`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **Reparto Móvil (Potosí 2)**| Milton Roxana Choque Quispe | `8002003` | `8002003@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Agente de Reparto (`6`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Móvil |
| **RRHH (Sucre)** | Lic. Patricia Eugenia Morales Soliz | `8001030` | `8001030@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor / Admin (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **RRHH (Potosí)** | Lic. Javier Fernando Paredes Cruz | `8002030` | `8002030@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor / Admin (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **RRHH (Multisede)** | Lic. Valeria Andrea Mercado Paz | `8003030` | `8003030@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor / Admin (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Híbrido Web 1 (Sucre)** | Andrea Sofía Durán Méndez | `8001040` | `8001040@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor (`5`) | **Sucre** (`1`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Híbrido Web 2 (Potosí)** | Mauricio José Alarcón Pinto | `8002040` | `8002040@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor / Admin (`5`) | **Potosí** (`2`) | **Mono-sede** (`puede_ver_todas: false`) | Web |
| **Híbrido Web 3 (Multisede)**| Lic. Álvaro Esteban Campero Daza | `8003040` | `8003040@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Supervisor / Admin (`5`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |
| **Híbrido Web 4 (Multisede)**| Lic. Gabriela Beatriz Salinas Rios | `8003050` | `8003050@papelblanquita.invalid` | `BlanquitaOperativo2026!` | Contador / Admin (`4`) | Base Sucre (`1`) | **Multisede** (`puede_ver_todas: true`) | Web |

---

## 2. Endpoints de Verificación de Login

Todos los usuarios cuentan con autenticación verificada exitosamente tanto en el acceso Web como en el acceso Móvil:

1. **Acceso Web / General:**
   - **Ruta:** `POST /auth/login`
   - **Payload:** `{"Ci": "<CI>", "Clave": "BlanquitaOperativo2026!"}`
   - **Respuesta:** HTTP 200 con `AccessToken` JWT y `RefreshToken`.

2. **Acceso Móvil / App Repartidores:**
   - **Ruta:** `POST /api/movil/v1/auth/login`
   - **Payload:** `{"Ci": "<CI>", "Clave": "BlanquitaOperativo2026!"}`
   - **Respuesta:** HTTP 200 con tokens JWT y objeto `usuario` con alcance territorial:
     * `sucursales_permitidas`: `[1]` para Sucre, `[2]` para Potosí.
     * `puede_ver_todas`: `false`.
     * `sucursal_defecto`: `1` (Sucre) o `2` (Potosí).

---

## 3. Zonas de Distribución Creadas en Potosí (`IdSucursal = 2`)

| ID Zona | Nombre de Zona | Ciudad | Descripción Operativa |
| :---: | :--- | :---: | :--- |
| **56** | `Zona Central Potosí` | Potosí | Centro histórico, Plaza 10 de Noviembre, mercados centrales y comercio tradicional. |
| **57** | `Zona Mercado Uyuni / Feria Popular` | Potosí | Eje comercial mayorista Av. Sevilla, Universitaria y Ferias Populares de Potosí. |
| **58** | `Zona Satélite / Ciudadela` | Potosí | Sector residencial y universitario, Ciudad Satélite, El Tejar y Hospital Daniel Bracamonte. |

---

## 4. Rutas y Puntos de Venta con Coordenadas Reales en Potosí

Todas las coordenadas están situadas dentro del municipio de Potosí (Latitud aprox `-19.58..`, Longitud aprox `-65.75..`):

### Ruta 201: Casco Central Potosí (ID 57)
- **Zona:** Zona Central Potosí (ID 56)
- **Chofer asignado:** Jaime Alberto Villegas Copa (CI 8002002)
- **Paradas Ordenadas (`RutaPuntoVenta`):**
  1. **Orden 1:** *La Casona Imperial - Central* (Calle Bolívar #45, Lat: `-19.5878000`, Lng: `-65.7538000`)
  2. **Orden 2:** *Abarrotes Don Carlos - Junín* (Calle Junín #120, Lat: `-19.5891000`, Lng: `-65.7525000`)
  3. **Orden 3:** *Minimarket San Roque - Bustillos* (Calle Bustillos #230, Lat: `-19.5882000`, Lng: `-65.7548000`)
  4. **Orden 4:** *Distribuidora Quijarro Central* (Calle Quijarro #85, Lat: `-19.5869000`, Lng: `-65.7529000`)

### Ruta 202: Mercado Uyuni y Feria Popular (ID 58)
- **Zona:** Zona Mercado Uyuni / Feria Popular (ID 57)
- **Chofer asignado:** Milton Roxana Choque Quispe (CI 8002003)
- **Paradas Ordenadas (`RutaPuntoVenta`):**
  1. **Orden 1:** *Comercial Carmen - Av. Universitaria* (Av. Universitaria #510, Lat: `-19.5782000`, Lng: `-65.7592000`)
  2. **Orden 2:** *El Minero - Mercado Uyuni Puesto 42* (Mercado Uyuni Puesto #42, Lat: `-19.5775000`, Lng: `-65.7601000`)
  3. **Orden 3:** *Distribuidora Sevilla - Principal* (Av. Sevilla #320, Lat: `-19.5768000`, Lng: `-65.7615000`)
  4. **Orden 4:** *La Terminal Express - Universitaria* (Av. Universitaria #180, Lat: `-19.5802000`, Lng: `-65.7583000`)

### Ruta 203: Ciudad Satélite y El Tejar (ID 59)
- **Zona:** Zona Satélite / Ciudadela (ID 58)
- **Chofer por defecto:** Jaime Alberto Villegas Copa (CI 8002002)
- **Paradas Ordenadas (`RutaPuntoVenta`):**
  1. **Orden 1:** *Satélite Express - Panamericana* (Av. Panamericana #102, Lat: `-19.5692000`, Lng: `-65.7684000`)
  2. **Orden 2:** *Doña Martha - El Tejar* (Calle El Tejar #45, Lat: `-19.5721000`, Lng: `-65.7648000`)
  3. **Orden 3:** *Abarrotes Ciudadela - Rotonda* (Rotonda Satélite #78, Lat: `-19.5684000`, Lng: `-65.7698000`)
  4. **Orden 4:** *Comercial El Tejar - Villazón* (Av. Villazón #405, Lat: `-19.5738000`, Lng: `-65.7635000`)

---

## 5. Stock Comercial en Almacenes (`inventario_sucursal`)

- **Sucursal 1 (Sucre):**
  * Presentación 10 (MRO-P12): 500.00 planchas disponibles
  * Presentación 11 (ECN-P20): 350.00 planchas disponibles
  * Presentación 13 (MER-P01): 200.00 planchas disponibles
  * Presentación 14 (MER-S01): 150.00 jabas disponibles
- **Sucursal 2 (Potosí):**
  * Presentación 10 (MRO-P12): 300.00 planchas disponibles
  * Presentación 11 (ECN-P20): 250.00 planchas disponibles
  * Presentación 13 (MER-P01): 150.00 planchas disponibles
  * Presentación 14 (MER-S01): 100.00 jabas disponibles

---

## 6. Instrucciones de Re-ejecución

El script es 100% idempotente y seguro:
```bash
# Simulación sin alterar la base de datos:
cd Blanquita-Backend && .\.venv\Scripts\python.exe app/cli/seed_operativo_sucre_potosi_completo.py --dry-run

# Ejecución real:
cd Blanquita-Backend && .\.venv\Scripts\python.exe app/cli/seed_operativo_sucre_potosi_completo.py
```
