-- =============================================================================
-- 035_seed_obregonense_2026.sql
--
-- Seed: Presupuesto General Equipo Obregonense 2026
--
-- Fuente: "Equipo Obregonense 2026.xlsx" — Hoja GENERAL
-- Estructura:
--   1 presupuesto general → 15 partidas (1 por disciplina / rubro)
--
-- Totales por partida (extraídos de la columna "TOTAL X DISCIPLINA"):
--   Equipamiento deportivo
--     TIRO            1,439,588
--     CANOTAJE          769,745
--     TKD               946,709
--     JUDO              735,546
--     KARATE            300,251
--     ATLETISMO         170,167
--     GIMNASIA          169,614
--     NATACIÓN          137,472
--     BOX               104,536
--     BÁDMINTON          97,696
--     BREAKING           47,678
--   Otros rubros
--     Nutrición / Suplementos   187,800
--     Transporte (aéreo + terrestre dedicado + ADO)  578,500
--     Hospedaje                  10,700
--     Viáticos en destino         3,800
--   ─────────────────────────────────
--   TOTAL GENERAL           5,699,802
--
-- Idempotente: usa INSERT … ON CONFLICT DO NOTHING para el budget.
-- Las partidas se insertan condicionalmente solo si el budget existe y
-- no tiene partidas aún.
-- =============================================================================

DO $$
DECLARE
  v_budget_id      UUID;
  v_cat_equipo     UUID;
  v_cat_viaticos   UUID;
  v_cat_otro       UUID;
BEGIN

  -- ------------------------------------------------------------------
  -- 1. Resolver IDs de categorías existentes (sembradas en 032)
  -- ------------------------------------------------------------------
  SELECT id INTO v_cat_equipo
    FROM public.finance_expense_categories WHERE name = 'Equipamiento' LIMIT 1;

  SELECT id INTO v_cat_viaticos
    FROM public.finance_expense_categories WHERE name = 'Viáticos' LIMIT 1;

  SELECT id INTO v_cat_otro
    FROM public.finance_expense_categories WHERE name = 'Otro' LIMIT 1;

  -- Fallback: si las categorías no existen aún (migración 032 no aplicada)
  -- no insertamos nada para no romper FK.
  IF v_cat_equipo IS NULL OR v_cat_viaticos IS NULL OR v_cat_otro IS NULL THEN
    RAISE NOTICE '035_seed: categorías financieras no encontradas. Asegúrate de aplicar 032_finance_tables.sql primero.';
    RETURN;
  END IF;

  -- ------------------------------------------------------------------
  -- 2. Crear el presupuesto (idempotente por nombre + año fiscal)
  -- ------------------------------------------------------------------
  INSERT INTO public.finance_budgets (
    name, description, fiscal_year,
    start_date, end_date, total_amount, status, notes
  )
  VALUES (
    'Presupuesto General Equipo Obregonense 2026',
    'Presupuesto integral para la temporada 2026 del Equipo Obregonense: equipamiento deportivo por disciplina, nutrición y suplementos, transporte, hospedaje y viáticos.',
    2026,
    '2026-01-01',
    '2026-12-31',
    5699802.00,
    'active',
    'Fuente: "Equipo Obregonense 2026.xlsx". Aprobado para gestión en plataforma AO Deportes.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_budget_id;

  -- Si ya existía, obtenerlo por nombre
  IF v_budget_id IS NULL THEN
    SELECT id INTO v_budget_id
      FROM public.finance_budgets
     WHERE name = 'Presupuesto General Equipo Obregonense 2026'
       AND fiscal_year = 2026
     LIMIT 1;
  END IF;

  IF v_budget_id IS NULL THEN
    RAISE NOTICE '035_seed: no se pudo crear ni encontrar el presupuesto.';
    RETURN;
  END IF;

  -- Si ya hay partidas, no duplicar
  IF EXISTS (SELECT 1 FROM public.finance_budget_items WHERE budget_id = v_budget_id) THEN
    RAISE NOTICE '035_seed: el presupuesto ya tiene partidas. Seed omitido.';
    RETURN;
  END IF;

  -- ------------------------------------------------------------------
  -- 3. Insertar partidas presupuestales
  -- ------------------------------------------------------------------

  -- ── Disciplinas de equipamiento ──────────────────────────────────
  INSERT INTO public.finance_budget_items (budget_id, category_id, name, description, amount)
  VALUES
    (v_budget_id, v_cat_equipo, 'Tiro',
     'Equipo especializado, uniformes e insumos para la disciplina de Tiro Deportivo',
     1439588.00),

    (v_budget_id, v_cat_equipo, 'Canotaje',
     'Equipo especializado, simuladores, uniformes e indumentaria AO para Canotaje',
     769745.00),

    (v_budget_id, v_cat_equipo, 'Taekwondo (TKD)',
     'Doboks, equipo electrónico KPNP / Daedo, protecciones y uniformes AO para TKD',
     946709.00),

    (v_budget_id, v_cat_equipo, 'Judo',
     'Tatamis Fuji Mats, judogis Mizuno/Fuji aprobados IJF y uniformes AO para Judo',
     735546.00),

    (v_budget_id, v_cat_equipo, 'Karate',
     'Combinaciones Arawaza, protecciones WKF y uniformes AO para Karate',
     300251.00),

    (v_budget_id, v_cat_equipo, 'Atletismo',
     'Tenis de competencia, ropa de licra y uniformes AO para Atletismo',
     170167.00),

    (v_budget_id, v_cat_equipo, 'Gimnasia',
     'Leotardos, calleras, trajes de gala y uniformes AO para Gimnasia',
     169614.00),

    (v_budget_id, v_cat_equipo, 'Natación',
     'Trajes, gorras, licras y uniformes AO para Natación',
     137472.00),

    (v_budget_id, v_cat_equipo, 'Box',
     'Shorts de boxeo, protectores, vendajes, calzado y uniformes AO para Box',
     104536.00),

    (v_budget_id, v_cat_equipo, 'Bádminton',
     'Raquetas Yonex, encordados, lanzaderas y uniformes AO para Bádminton',
     97696.00),

    (v_budget_id, v_cat_equipo, 'Breaking',
     'Pantalones, tenis de danza y uniformes AO para Breaking',
     47678.00),

  -- ── Nutrición y suplementos ───────────────────────────────────────
    (v_budget_id, v_cat_otro, 'Nutrición y suplementos',
     'Proteína Isopure 3LB (120 unidades) + Gatorade en polvo galón (120 unidades) para todos los atletas',
     187800.00),

  -- ── Transporte ────────────────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Transporte',
     'Transporte aéreo (boletos ida/vuelta a GDL, MTY, TIJ, MER, VER) + transporte terrestre dedicado y ADO a sedes de competencia nacionales: León, Puebla, CDMX, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     578500.00),

  -- ── Hospedaje ─────────────────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Hospedaje',
     'Hotel ONE / City Express — habitación sencilla por noche en sedes: León, Monterrey, Puebla, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     10700.00),

  -- ── Viáticos en destino ───────────────────────────────────────────
    (v_budget_id, v_cat_viaticos, 'Viáticos en destino',
     'Gastos de alimentación y movilidad local por destino: León, Monterrey, Puebla, Progreso Yucatán, Acapulco, Guadalajara, Tlaxcala',
     3800.00);

  RAISE NOTICE '035_seed: presupuesto "Equipo Obregonense 2026" creado con 15 partidas. Total: $5,699,802 MXN';

END $$;
