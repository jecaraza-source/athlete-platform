-- Campos extendidos en activities para planificación deportiva y Atención Operativa
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS disciplina           text,
  ADD COLUMN IF NOT EXISTS especialidad         text,
  ADD COLUMN IF NOT EXISTS actividad_tipo       text,
  ADD COLUMN IF NOT EXISTS sede                 text,
  ADD COLUMN IF NOT EXISTS horario              time,
  ADD COLUMN IF NOT EXISTS requerimiento        text,
  ADD COLUMN IF NOT EXISTS numero_participantes integer,
  ADD COLUMN IF NOT EXISTS personal_requerido   text,
  ADD COLUMN IF NOT EXISTS equipo_requerido     text,
  ADD COLUMN IF NOT EXISTS objetivo             text,
  ADD COLUMN IF NOT EXISTS atencion_actividad   text,
  ADD COLUMN IF NOT EXISTS atencion_fecha       date;
