# 📊 Reporte de Atletas Duplicados

**Fecha**: 12 de Junio, 2026  
**Base de Datos**: Supabase (gwjnqokwchdojlcngtbi)  
**Estado**: Verificado y Confirmado

---

## 🔴 RESUMEN EJECUTIVO

Se han identificado **2 grupos de atletas duplicados** en la base de datos:
- **Total de registros**: 145 atletas
- **Registros únicos**: 143 atletas
- **Duplicados encontrados**: 2 grupos (4 registros adicionales)
- **Referencias dispersas**: 24 registros en otras tablas

---

## 📋 ATLETAS DUPLICADOS IDENTIFICADOS

### 1️⃣ **Alan Uriel Rivera Antunez**

| Propiedad | Valor |
|-----------|-------|
| **Registro Principal** | `40e595a2-0004-4ce4-89e8-bbc955732242` |
| **Registro Duplicado** | `ae7526bf-343a-47df-a3a6-820d71f38752` |
| **Fecha Creación** | 2026-06-09 (ambos) |
| **Estado** | Active (ambos) |
| **Referencias Dispersas** | 12 registros |

#### Desglose de Referencias:
- `athlete_initial_diagnostic`: 1 principal + 1 duplicado = **2 registros**
- `athlete_diagnostic_sections`: 5 principal + 5 duplicado = **10 registros**

**Impacto**: Información de diagnóstico inicial dividida entre dos registros

---

### 2️⃣ **Dominique Yahel Corona Mendoza**

| Propiedad | Valor |
|-----------|-------|
| **Registro Principal** | `39720418-cac5-4e88-b96f-1ba5a592f281` |
| **Registro Duplicado** | `12aadfc3-bf84-4802-9864-850b2b1f38e3` |
| **Fecha Creación** | 2026-06-09 (ambos) |
| **Estado** | Active (ambos) |
| **Referencias Dispersas** | 12 registros |

#### Desglose de Referencias:
- `athlete_initial_diagnostic`: 1 principal + 1 duplicado = **2 registros**
- `athlete_diagnostic_sections`: 5 principal + 5 duplicado = **10 registros**

**Impacto**: Información de diagnóstico inicial dividida entre dos registros

---

## 📊 ESTADÍSTICAS

### Estadísticas Generales:
```
Total de registros de atletas:        145
Total de nombres únicos:               143
Registros duplicados:                    2
Porcentaje de duplicación:         1.38%
```

### Distribución de Referencias Dispersas:
```
athlete_initial_diagnostic:             4 registros (2 por atleta)
athlete_diagnostic_sections:           20 registros (10 por atleta)
├─ Subtotal:                          24 referencias
```

### Tablas SIN referencias a duplicados:
```
✓ training_sessions
✓ nutrition_plans
✓ physio_cases
✓ psychology_cases
✓ event_participants
✓ athlete_notes
✓ injuries
✓ athlete_attachments
```

---

## 🎯 SOLUCIÓN RECOMENDADA

### **Opción A: Consolidación Automática (RECOMENDADO)**

Usar el script `consolidate_duplicate_athletes.py`:

```bash
# Paso 1: Validar con dry-run
python3 apps/web/scripts/consolidate_duplicate_athletes.py --dry-run

# Paso 2: Ejecutar consolidación
python3 apps/web/scripts/consolidate_duplicate_athletes.py

# Paso 3: Eliminar duplicados
python3 apps/web/scripts/consolidate_duplicate_athletes.py --delete-duplicates
```

**Resultado esperado**:
- ✅ 24 referencias redireccionadas al registro principal
- ✅ 2 registros duplicados eliminados
- ✅ Base de datos limpia y consistente
- ✅ Auditoría registrada en `athlete_consolidation_audit`

---

### **Opción B: Consolidación Manual**

Si prefieres hacerlo manualmente:

```sql
-- Redireccionamiento de referencias para Alan Uriel Rivera Antunez
UPDATE athlete_initial_diagnostic 
SET athlete_id = '40e595a2-0004-4ce4-89e8-bbc955732242'
WHERE athlete_id = 'ae7526bf-343a-47df-a3a6-820d71f38752';

UPDATE athlete_diagnostic_sections
SET athlete_id = '40e595a2-0004-4ce4-89e8-bbc955732242'
WHERE athlete_id = 'ae7526bf-343a-47df-a3a6-820d71f38752';

-- Redireccionamiento de referencias para Dominique Yahel Corona Mendoza
UPDATE athlete_initial_diagnostic 
SET athlete_id = '39720418-cac5-4e88-b96f-1ba5a592f281'
WHERE athlete_id = '12aadfc3-bf84-4802-9864-850b2b1f38e3';

UPDATE athlete_diagnostic_sections
SET athlete_id = '39720418-cac5-4e88-b96f-1ba5a592f281'
WHERE athlete_id = '12aadfc3-bf84-4802-9864-850b2b1f38e3';

-- Eliminar registros duplicados
DELETE FROM athletes WHERE id = 'ae7526bf-343a-47df-a3a6-820d71f38752';
DELETE FROM athletes WHERE id = '12aadfc3-bf84-4802-9864-850b2b1f38e3';
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Antes de Ejecutar:

1. ✅ **BACKUP**: Hacer backup completo de la BD
   ```bash
   # En Supabase dashboard: Database > Backups > Create a backup
   ```

2. ✅ **VALIDACIÓN**: Ejecutar dry-run primero
   ```bash
   python3 apps/web/scripts/consolidate_duplicate_athletes.py --dry-run
   ```

3. ✅ **TESTING**: Si es posible, probar en ambiente de staging

4. ✅ **DOCUMENTACIÓN**: Registrar cambios en ticket/PR

### Después de Ejecutar:

1. ✅ Verificar que las referencias fueron redireccionadas
2. ✅ Revisar tabla `athlete_consolidation_audit`
3. ✅ Validar que la UI muestra información correcta
4. ✅ Aplicar migración 050 para prevenir futuros duplicados

---

## 🔒 PREVENCIÓN FUTURA

Una vez consolidados, aplicar la migración:

```bash
# Aplica la migración 050_prevent_duplicate_athletes.sql
supabase migration up
```

Esto añade:
- ✅ Constraint UNIQUE (first_name, last_name)
- ✅ Tabla de auditoría
- ✅ Previene nuevos duplicados automáticamente

---

## 📈 ESTIMACIÓN DE TIEMPO

| Fase | Duración | Descripción |
|------|----------|-------------|
| Análisis (dry-run) | 2-5 min | Validar cambios |
| Consolidación | 5-10 min | Ejecutar script |
| Limpieza | 1-2 min | Eliminar duplicados |
| Prevención | 1-2 min | Aplicar migración |
| **TOTAL** | **10-20 min** | **Solución completa** |

---

## 📞 SOPORTE

### Preguntas Frecuentes:

**¿Qué sucede con el diagnóstico duplicado?**
- Se mantendrá el diagnóstico del registro principal
- Opcionalmente, los datos del duplicado pueden ser revisados primero

**¿Se perderán datos?**
- No. Las referencias serán redireccionadas, no eliminadas

**¿Es reversible?**
- Parcialmente. La tabla `athlete_consolidation_audit` registra todos los cambios
- Se puede restaurar desde backup si es necesario

**¿Afectará a los usuarios?**
- No. Los cambios son transparentes a nivel de aplicación
- El atleta seguirá siendo accesible con el mismo ID principal

---

## ✅ ESTADO ACTUAL

```
Duplicados Identificados:     ✓ 2 grupos
Referencias Analizadas:       ✓ 24 registros
Impacto Evaluado:            ✓ Bajo (solo diagnóstico inicial)
Solución Preparada:          ✓ Script listo
Documentación Completa:      ✓ Disponible
Migración de Prevención:     ✓ Preparada

ESTADO: LISTO PARA CONSOLIDAR
```

---

## 🚀 PRÓXIMOS PASOS

1. **Revisar este reporte** ✓
2. **Hacer backup de BD** → `supabase/backups`
3. **Ejecutar script de análisis** → `python3 consolidate_duplicate_athletes.py --dry-run`
4. **Validar resultados** → Revisar reporte
5. **Ejecutar consolidación** → `python3 consolidate_duplicate_athletes.py`
6. **Eliminar duplicados** → `python3 consolidate_duplicate_athletes.py --delete-duplicates`
7. **Aplicar migración 050** → `supabase migration up`
8. **Verificar BD** → Confirmar que todo está correcto

---

**Documento Generado**: 12 de Junio, 2026  
**Responsable**: Oz Agent  
**Verificación**: Base de datos actualizada en tiempo real
