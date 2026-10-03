# ESPECIFICACIÓN DE REQUISITOS DEL SISTEMA

**Proyecto:** Desarrollo de un Sistema Web para la Administración y Análisis de Datos en la Empresa de Papel "Blanquita" de la Ciudad de Sucre  
**Organización:** *Shema Asociados S.R.L.*  
**Ubicación:** Sucre, Chuquisaca, Bolivia  

---

## 1. ESTRUCTURA DE MÓDULOS DEL SISTEMA

El sistema informático se concibe como una plataforma integral centralizada en la nube con acceso **Web** para la gestión administrativa-contable y una **Aplicación Móvil** (*Offline-First*) para el personal de reparto en campo. Se organiza en cinco módulos funcionales:

1. **Módulo 1: Seguridad, Administración y Auditoría:** Gestión de usuarios, asignación de perfiles (Roles RBAC), control de credenciales y registros inmutables de auditoría transaccional.
2. **Módulo 2: Administración, Tesorería y Cuentas por Cobrar:** Control de caja diaria, registro de ingresos/egresos, gestión de estados de cuenta de clientes, seguimiento de créditos y conciliación de rendiciones de dinero.
3. **Módulo 3: Recursos Humanos y Control de Asistencia (Biométrico):** Importación y procesamiento de marcas del reloj biométrico, cómputo de horas extra, atrasos, comisiones por ventas en ruta y emisión de la planilla salarial.
4. **Módulo 4: Logística, Rutas y Distribución Móvil:** Asignación de rutas urbanas en Sucre, registro de pedidos en campo, captura de coordenadas GPS, confirmación de entregas y operación sin conexión a internet (*Offline*).
5. **Módulo 5: Reportes, Análisis y Visualización de Datos:** Generación de recibos y notas en formato PDF, paneles ejecutivos (Dashboards) de flujo de caja, cobranzas del día y rendimiento por ruta/repartidor.

---

## 2. REQUERIMIENTOS FUNCIONALES (RF)

| Código | Requerimiento Funcional | Descripción del Requerimiento | Módulo |
| :---: | :---: | :---: | :---: |
| **RF-01** | Autenticación y Control de Acceso | Permitir el ingreso seguro al sistema mediante correo/usuario y contraseña cifrada, emitiendo tokens de sesión (JWT). | Seguridad |
| **RF-02** | Gestión de Roles y Permisos (RBAC) | Restringir las funcionalidades del sistema según el perfil asignado (Gerente General, Contador, Supervisor, Agente de Reparto). | Seguridad |
| **RF-03** | Registro e Historial de Auditoría (Logs) | Registrar de forma automática e inmutable la fecha, hora, usuario y acción realizada en operaciones críticas (modificaciones financieras, anulaciones). | Seguridad |
| **RF-04** | Apertura y Cierre de Caja Diaria | Permitir la apertura de caja con un saldo inicial y registrar el arqueo/cierre de caja al finalizar la jornada laboral. | Tesorería |
| **RF-05** | Registro de Ingresos y Egresos | Permitir el registro clasificado de entradas y salidas de dinero extraordinarias o de funcionamiento operativo. | Tesorería |
| **RF-06** | Gestión de Cuentas por Cobrar | Mantener el saldo deudor actualizado por cliente, registrando planes de pago, abonos parciales y liquidación total de créditos. | Tesorería |
| **RF-07** | Conciliación de Rendición en Ruta | Cotejar los valores cobrados en efectivo o transferencias reportados por los repartidores contra las entregas físicas de dinero en caja. | Tesorería |
| **RF-08** | Importación de Marcas Biométricas | Importar y procesar los registros de entradas, salidas y marcaciones del personal desde el hardware de control biométrico. | Recursos Humanos |
| **RF-09** | Cómputo de Atrasos y Faltas | Calcular automáticamente los minutos de retraso, faltas justificadas/injustificadas y recargos por horas extraordinarias según horario laboral. | Recursos Humanos |
| **RF-10** | Cálculo de Comisiones de Reparto | Determinar las bonificaciones del personal de distribución basadas exclusivamente en los montos de venta cobrados y liquidados en caja. | Recursos Humanos |
| **RF-11** | Emisión de Planilla de Sueldos | Generar la planilla mensual de salarios integrando sueldo básico, horas extra, comisiones y deducciones legales de ley. | Recursos Humanos |
| **RF-12** | Gestión de Clientes y Puntos de Venta | Registrar la información comercial de clientes, incluyendo razón social, NIT/CI, teléfono, dirección y ubicación en mapa. | Logística / Móvil |
| **RF-13** | Programación y Asignación de Rutas | Asignar a los repartidores la lista diaria de clientes y zonas de distribución en la ciudad de Sucre. | Logística / Móvil |
| **RF-14** | Registro de Pedidos y Ventas Directas | Permitir a los repartidores la toma de pedidos y ventas directas en ruta seleccionando los productos de papel (megarrollos, económico, servilletas). | Logística / Móvil |
| **RF-15** | Funcionamiento Móvil Offline | Permitir que la aplicación móvil ejecute lecturas, registros de ventas y cobros en zonas de Sucre sin cobertura de internet, guardando los datos localmente. | Logística / Móvil |
| **RF-16** | Sincronización Automática de Datos | Enviar al servidor central la información registrada en la App Móvil de forma automática una vez restablecida la conexión a internet. | Logística / Móvil |
| **RF-17** | Captura de Geolocalización GPS | Registrar la coordenada geográfica (latitud y longitud) del dispositivo móvil al momento de confirmar una entrega o cobro. | Logística / Móvil |
| **RF-18** | Generación de Notas y Recibos PDF | Emitir documentos digitales en PDF correspondientes a notas de entrega, comprobantes de pago y estados de cuenta de clientes. | Reportes |
| **RF-19** | Dashboard de Flujo de Caja | Mostrar gráficos interactivos en tiempo real del saldo disponible, ingresos diarios, egresos acumulados y proyección de liquidez. | Reportes |
| **RF-20** | Dashboard de Desempeño Logístico | Visualizar métricas de efectividad por ruta de entrega, volumen de ventas por repartidor y tasa de recuperación de cartera vencida. | Reportes |

---

## 3. REQUERIMIENTOS NO FUNCIONALES (RNF)

* **RNF-01 (Disponibilidad y Tolerancia a Fallos):** La arquitectura móvil debe implementar el patrón *Offline-First* con base de datos local (SQLite), garantizando el 100% de operatividad del repartidor en campo independientemente de la estabilidad de la red celular.
* **RNF-02 (Seguridad y Cifrado):** La comunicación entre el servidor backend y los clientes (Web y Móvil) debe realizarse bajo protocolo HTTPS/TLS. El acceso a la base de datos Supabase se restringirá mediante políticas de seguridad a nivel de fila (RLS).
* **RNF-03 (Rendimiento y Tiempo de Respuesta):** Las consultas de información financiera y actualización de transacciones en la plataforma web deben procesarse en un tiempo no mayor a 2 segundos bajo condiciones normales de carga.
* **RNF-04 (Usabilidad e Interfaz):** Las interfaces de la aplicación móvil deben estar diseñadas con criterios de diseño adaptativo (*Responsive*), botones de gran tamaño y un flujo de máximo 3 pasos para completar una venta en ruta.
* **RNF-05 (Integridad Transaccional):** La base de datos relacional PostgreSQL debe garantizar las propiedades ACID (Atomicidad, Consistencia, Aislamiento y Durabilidad) en la consolidación de pagos, asientos de caja y ventas sincronizadas.

---

## 4. REGLAS DE NEGOCIO (RN)

* **RN-01 (Bloqueo de Clientes por Mora):** El sistema debe bloquear automáticamente la opción de venta a crédito para aquellos clientes que registren facturas/notas vencidas con más de 15 días de antigüedad o cuyo saldo deudor supere el límite configurado.
* **RN-02 (Liquidación Efectiva de Comisiones):** El cálculo de comisiones de reparto se efectuará únicamente sobre los montos cobrados y liquidados en caja física, prohibiendo el cómputo de comisiones sobre pedidos a crédito pendientes de cobro.
* **RN-03 (Conciliación Obligatoria de Cierre de Caja):** Ninguna caja diaria podrá cerrarse formalmente si existen diferencias entre el saldo teórico del sistema y el efectivo rendido por los repartidores, requiriendo autorización expresa del Contador.
* **RN-04 (Inmutabilidad de Registros Contables):** Queda prohibida la eliminación física de registros de venta o cobros liquidados. Toda corrección deberá realizarse mediante asientos de anulación o nota de crédito con su respectivo registro en el log de auditoría.
* **RN-05 (Cómputo Laboral según Ley):** Los cálculos de asistencia, tolerancias de atraso (máximo 10 minutos) y pago de horas extra (100% de recargo) se ajustarán estrictamente a los parámetros fijados por la Ley General del Trabajo de Bolivia.
