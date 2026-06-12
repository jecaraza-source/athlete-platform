-- ============================================================
-- Migration 048: Sincronización automática de email
--                entre profiles → athletes
-- ============================================================
-- Objetivo: mantener athletes.email siempre igual al email
-- del perfil vinculado (profiles.id = athletes.profile_id).
--
-- Cubre dos escenarios:
--   1. Se actualiza profiles.email → se propaga a athletes
--   2. Se inserta/actualiza athletes.profile_id → se copia
--      el email desde profiles
-- ============================================================

-- ── Función 1: profiles → athletes (propagación de cambio) ──
CREATE OR REPLACE FUNCTION sync_email_to_athlete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actuar si el email realmente cambió
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE athletes
    SET    email      = NEW.email,
           updated_at = NOW()
    WHERE  profile_id = NEW.id
      -- Evitar sobreescribir si otro atleta ya usa ese email
      AND NOT EXISTS (
        SELECT 1 FROM athletes
        WHERE  email = NEW.email
          AND  id   != athletes.id
      );
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger 1: se dispara al actualizar email en profiles ───
DROP TRIGGER IF EXISTS trg_sync_email_to_athlete ON profiles;
CREATE TRIGGER trg_sync_email_to_athlete
  AFTER UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_to_athlete();

-- ── Función 2: athletes ← profiles (al vincular profile_id) ─
CREATE OR REPLACE FUNCTION sync_email_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Solo actuar si profile_id fue asignado o cambió
  IF NEW.profile_id IS NOT NULL AND
     NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN

    SELECT email INTO v_email
    FROM   profiles
    WHERE  id = NEW.profile_id;

    -- Copiar solo si el atleta no tiene email y no hay conflicto
    IF v_email IS NOT NULL AND NEW.email IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM athletes
        WHERE  email = v_email
          AND  id   != NEW.id
      ) THEN
        NEW.email := v_email;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger 2: se dispara al asignar/cambiar profile_id ────
DROP TRIGGER IF EXISTS trg_sync_email_from_profile ON athletes;
CREATE TRIGGER trg_sync_email_from_profile
  BEFORE INSERT OR UPDATE OF profile_id ON athletes
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_from_profile();

-- ── Sync inicial: poblar emails faltantes ya vinculados ─────
-- (aplica solo a atletas sin email pero con profile_id válido)
UPDATE athletes a
SET    email      = p.email,
       updated_at = NOW()
FROM   profiles p
WHERE  a.profile_id = p.id
  AND  a.email      IS NULL
  AND  p.email      IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM athletes a2
    WHERE  a2.email = p.email
      AND  a2.id   != a.id
  );
