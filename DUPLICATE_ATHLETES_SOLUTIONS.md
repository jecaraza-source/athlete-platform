# Soluciones para Atletas Duplicados

## 📋 Resumen Ejecutivo

Este documento presenta un análisis completo y soluciones viables para identificar, consolidar y prevenir atletas duplicados en la plataforma Athlete Platform.

---

## 🔍 PROBLEMA

La base de datos contiene atletas duplicados causados por:
- Importaciones múltiples de Excel sin validación de duplicados
- Creación manual de registros sin verificación
- Falta de constraints únicos en la tabla de atletas

### Impacto
- **Datos inconsistentes**: Mismo atleta en múltiples registros
- **Referencias dispersas**: Training sessions, nutrition plans, etc. repartidas entre duplicados
- **Dificultad operacional**: Información dividida del atleta

---

## ✅ SOLUCIONES PROPUESTAS

### Opción 1: Script de Consolidación Automática (RECOMENDADO)
**Archivo**: `apps/web/scripts/consolidate_duplicate_athletes.py`

#### Características:
- ✅ Identifica automáticamente duplicados por nombre completo
- ✅ Preserva el registro más antiguo (creado primero)
- ✅ Redirecciona todas las referencias al registro principal
- ✅ Modo dry-run para validar cambios antes de ejecutar
- ✅ Opcionalmente elimina registros duplicados

#### Uso:

```bash
# 1. Primero, simulación (sin cambios reales)
cd apps/web
python3 scripts/consolidate_duplicate_athletes.py --dry-run

# 2. Si el reporte se ve bien, ejecutar consolidación
python3 scripts/consolidate_duplicate_athletes.py

# 3. Opcionalmente, eliminar registros duplicados después
python3 scripts/consolidate_duplicate_athletes.py --delete-duplicates
```

#### Tablas Afectadas:
- `athletes` (origen de duplicados)
- `training_sessions` (athlete_id)
- `nutrition_plans` (athlete_id)
- `physio_cases` (athlete_id)
- `psychology_cases` (athlete_id)
- `event_participants` (participant_id)
- `athlete_notes` (athlete_id)
- `athlete_initial_diagnostic` (athlete_id)
- `athlete_diagnostic_sections` (athlete_id)
- `injuries` (athlete_id)
- `athlete_attachments` (athlete_id)

---

### Opción 2: Análisis SQL Detallado
**Archivo**: `apps/web/scripts/analyze_duplicate_athletes.sql`

#### Uso en Supabase SQL Editor:

```sql
-- Copiar y pegar el contenido del archivo analyze_duplicate_athletes.sql
-- en el editor SQL de Supabase
```

#### Reportes Generados:
1. **Duplicados por Nombre**: Lista atletas con mismo nombre/apellido
2. **Duplicados por Email**: Lista por email duplicado
3. **Duplicados por Nombre Normalizado**: Detecta variaciones (espacios, acentos)
4. **Análisis de Impacto**: Cuántas referencias hay en cada tabla
5. **Resumen General**: Total de registros duplicados

---

### Opción 3: Migración para Prevención Futura
**Archivo**: `supabase/migrations/050_prevent_duplicate_athletes.sql`

#### Cambios:
1. ✅ Crea tabla de auditoría (`athlete_consolidation_audit`)
2. ✅ Añade constraint UNIQUE (first_name, last_name)
3. ✅ Registra auditoría de consolidaciones
4. ✅ Previene nuevos duplicados

#### Ejecución:
```bash
# Aplicar mediante Supabase CLI o dashboard
supabase migration up
```

**⚠️ IMPORTANTE**: Esta migración fallará si existen duplicados.
**ORDEN CORRECTO**:
1. Ejecutar Opción 1 (consolidate_duplicate_athletes.py)
2. Luego aplicar Opción 3 (migración 050)

---

## 📊 PLAN DE EJECUCIÓN RECOMENDADO

### Fase 1: Análisis (0-1 hora)
```bash
cd apps/web
python3 scripts/consolidate_duplicate_athletes.py --dry-run
```
- Genera reporte de duplicados encontrados
- Muestra referencias que serán redireccionadas
- **Sin cambios en BD**

### Fase 2: Validación (1-2 horas)
- Revisar reporte de Fase 1
- Validar que los duplicados identificados son reales
- Confirmar que la consolidación mantiene integridad referencial

### Fase 3: Consolidación (5-30 minutos)
```bash
cd apps/web
python3 scripts/consolidate_duplicate_athletes.py
```
- Ejecuta consolidación
- Redirige todas las referencias
- Genera logs de cambios

### Fase 4: Limpieza Opcional (5 minutos)
```bash
cd apps/web
python3 scripts/consolidate_duplicate_athletes.py --delete-duplicates
```
- Elimina registros duplicados
- Libera espacio en BD
- **Requiere Fase 3 completada**

### Fase 5: Prevención Futura (1-5 minutos)
```bash
# Aplicar migración 050
supabase migration up
```
- Previene nuevos duplicados
- Crea auditoría de consolidaciones
- **Solo después de Fase 3 completada**

---

## 🛡️ SEGURIDAD Y AUDITORÍA

### Protecciones Incorporadas:
✅ Modo dry-run para validación previa
✅ Preserva registros más antiguos (información histórica)
✅ Redirige ALL references (integridad referencial)
✅ Tabla de auditoría para rastrabilidad
✅ Logs detallados de cambios

### Auditoría de Cambios:
Tabla `athlete_consolidation_audit` registra:
- Atleta principal conservado
- IDs de duplicados consolidados
- Número de referencias actualizadas
- Quién realizó la consolidación
- Timestamp exacto

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Antes de Ejecutar:
1. ✅ **BACKUP**: Hacer backup completo de BD antes de Fase 3
2. ✅ **TESTING**: Ejecutar en ambiente de test primero
3. ✅ **DRY-RUN**: Siempre hacer dry-run antes de cambios reales
4. ✅ **VALIDACIÓN**: Revisar reporte antes de consolidar

### Limitaciones:
- Script identifica duplicados por nombre exacto (no fuzzy matching)
- No consolida por email, teléfono u otros campos
- Conserva registro más antiguo (puede revisar manualmente si es necesario)

### Posibles Mejoras Futuras:
- [ ] Fuzzy matching (nombres similares)
- [ ] Consolidación por documento/ID
- [ ] Interfaz UI para revisión manual
- [ ] Histórico de cambios en atleta

---

## 🔧 REQUISITOS TÉCNICOS

### Dependencies:
```bash
pip3 install requests python-dotenv
```

### Configuración:
- Requiere `.env.local` con:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Permisos:
- Script requiere service role key (máximos permisos)
- Migración requiere permisos de admin en Supabase

---

## 📞 CONTACTO Y SOPORTE

Para preguntas o issues:
1. Revisar logs del script
2. Validar credenciales en `.env.local`
3. Verificar conexión a Supabase
4. Revisar tabla `athlete_consolidation_audit` para historial

---

## 📚 ARCHIVOS RELACIONADOS

```
apps/web/scripts/
├── consolidate_duplicate_athletes.py    # Script principal (USAR)
└── analyze_duplicate_athletes.sql       # Análisis detallado

supabase/migrations/
└── 050_prevent_duplicate_athletes.sql   # Prevención futura

DUPLICATE_ATHLETES_SOLUTIONS.md          # Este documento
```

---

## ✨ RESUMEN

**Solución viable y completa para atletas duplicados:**

1. ✅ **Identificación**: Script automático detecta todos los duplicados
2. ✅ **Consolidación**: Mantiene integridad referencial
3. ✅ **Prevención**: Migración SQL previene futuros duplicados
4. ✅ **Auditoría**: Registro completo de todos los cambios
5. ✅ **Seguridad**: Modo dry-run para validación previa

**Próximo paso**: Ejecutar `consolidate_duplicate_athletes.py --dry-run`

