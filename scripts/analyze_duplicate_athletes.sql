-- ============================================================================
-- Script de Análisis: Atletas Duplicados
-- ============================================================================
-- Identifica atletas duplicados por diversos criterios y muestra su impacto
-- en las relaciones de la base de datos.

-- ============================================================================
-- 1. DUPLICADOS POR NOMBRE COMPLETO (first_name + last_name)
-- ============================================================================

SELECT 
  first_name,
  last_name,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ' ORDER BY created_at) as ids,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as created_at_list,
  STRING_AGG(status::text, ', ' ORDER BY created_at) as status_list
FROM athletes
GROUP BY first_name, last_name
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- ============================================================================
-- 2. DUPLICADOS POR EMAIL (si está disponible)
-- ============================================================================

SELECT 
  email,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ' ORDER BY created_at) as ids,
  STRING_AGG(CONCAT(first_name, ' ', last_name), ', ' ORDER BY created_at) as names,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as created_at_list
FROM athletes
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- ============================================================================
-- 3. DUPLICADOS POR NOMBRE NORMALIZADO (sin espacios, minúsculas)
-- ============================================================================

SELECT 
  LOWER(REPLACE(CONCAT(first_name, last_name), ' ', '')) as normalized_name,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ' ORDER BY created_at) as ids,
  STRING_AGG(CONCAT(first_name, ' ', last_name), ', ' ORDER BY created_at) as names,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as created_at_list
FROM athletes
GROUP BY LOWER(REPLACE(CONCAT(first_name, last_name), ' ', ''))
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- ============================================================================
-- 4. ANÁLISIS DE IMPACTO: REFERENCIAS A ATLETAS DUPLICADOS
-- ============================================================================

-- Crea una tabla temporal de duplicados para análisis
WITH duplicates AS (
  SELECT 
    first_name,
    last_name,
    array_agg(id ORDER BY created_at) as athlete_ids
  FROM athletes
  GROUP BY first_name, last_name
  HAVING COUNT(*) > 1
),

-- Encuentra todas las referencias a atletas duplicados
references AS (
  SELECT 'training_sessions' as table_name, COUNT(*) as ref_count
  FROM training_sessions ts
  JOIN duplicates d ON ts.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'nutrition_plans', COUNT(*)
  FROM nutrition_plans np
  JOIN duplicates d ON np.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'physio_cases', COUNT(*)
  FROM physio_cases pc
  JOIN duplicates d ON pc.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'psychology_cases', COUNT(*)
  FROM psychology_cases psy
  JOIN duplicates d ON psy.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'event_participants', COUNT(*)
  FROM event_participants ep
  JOIN duplicates d ON ep.participant_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'athlete_notes', COUNT(*)
  FROM athlete_notes an
  JOIN duplicates d ON an.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'athlete_initial_diagnostic', COUNT(*)
  FROM athlete_initial_diagnostic aid
  JOIN duplicates d ON aid.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'athlete_diagnostic_sections', COUNT(*)
  FROM athlete_diagnostic_sections ads
  JOIN duplicates d ON ads.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'injuries', COUNT(*)
  FROM injuries inj
  JOIN duplicates d ON inj.athlete_id = ANY(d.athlete_ids)
  UNION ALL
  SELECT 'athlete_attachments', COUNT(*)
  FROM athlete_attachments aa
  JOIN duplicates d ON aa.athlete_id = ANY(d.athlete_ids)
)
SELECT * FROM references WHERE ref_count > 0 ORDER BY ref_count DESC;

-- ============================================================================
-- 5. RESUMEN GENERAL
-- ============================================================================

SELECT 
  (SELECT COUNT(DISTINCT CONCAT(first_name, last_name)) FROM athletes 
   WHERE CONCAT(first_name, last_name) IN (
     SELECT CONCAT(first_name, last_name) FROM athletes 
     GROUP BY first_name, last_name HAVING COUNT(*) > 1
   )) as total_duplicate_records,
  
  (SELECT COUNT(*) FROM athletes) as total_athletes,
  
  (SELECT COUNT(DISTINCT CONCAT(first_name, last_name)) FROM athletes) as unique_athlete_names;
