# PLANTILLA DE RELEVO DE TURNO / HANDOFF (`docs/progress/HANDOFF_TEMPLATE.md`)

*Utiliza esta plantilla cuando finalices tu turno dejando tareas en progreso o cuando traspases el trabajo a otro agente/subagente.*

---

## 1. Identificación del Turno
- **Fecha y Hora:** `[AAAA-MM-DD HH:MM]`
- **Agente / Subagente Emisor:** `[Agente Principal / Subagente A, B, C, D, E, F]`
- **Fase y Módulo en Desarrollo:** `[Ej. Fase 1 - Módulo 1 / Fase 2 - Subagente B]`

---

## 2. Estado Actual de la Tarea
- **Qué se completó en este turno:**
  - `[Detalle conciso de endpoints, tablas o pantallas terminadas y comprobadas]`
- **Archivos creados o modificados:**
  - `[Lista de rutas exactas de archivos]`
- **Migraciones ejecutadas en BD:**
  - `[Nombre del script SQL o tabla modificada]`

---

## 3. Qué Falta por Hacer (Próximos Pasos Inmediatos)
- [ ] `[Tarea pendiente 1]`
- [ ] `[Tarea pendiente 2]`
- [ ] `[Tarea pendiente 3]`

---

## 4. Decisiones Técnicas Tomadas
- `[Decisión y motivo adoptado durante el turno para resolver cualquier caso no contemplado]`

---

## 5. Bloqueos, Advertencias o Puntos de Atención
- `[Indicar si hay dependencias pendientes con otro subagente o si se requiere confirmación del usuario]`

---

## 6. Comandos para Verificar y Retomar
```bash
# Ejecutar tests de la sección
cd Blanquita-Backend && .\.venv\Scripts\pytest.exe tests/unit/test_unit_xxx.py -v

# Verificar zona protegida
.\.venv\Scripts\python.exe docs/scripts/verificar_zona_protegida.py

# Levantar frontend para comprobar pantalla
cd Blanquita-Frontend && npm run dev
```
