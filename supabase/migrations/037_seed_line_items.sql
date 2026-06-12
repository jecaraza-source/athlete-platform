-- =============================================================================
-- 037_seed_line_items.sql
--
-- Seed: todos los artículos del "Presupuesto 2026.xlsx" — Hoja GENERAL
-- Fuente: Equipo Obregonense 2026 (187 renglones)
--
-- Idempotente: solo inserta si no existen renglones para ese presupuesto.
-- =============================================================================

DO $$
DECLARE
  v_budget_id UUID;
BEGIN
  -- Obtener el ID del presupuesto Obregonense 2026
  SELECT id INTO v_budget_id
    FROM public.finance_budgets
   WHERE name = 'Presupuesto General Equipo Obregonense 2026'
     AND fiscal_year = 2026
   LIMIT 1;

  IF v_budget_id IS NULL THEN
    RAISE NOTICE '037_seed: presupuesto Obregonense 2026 no encontrado. Aplica 035 primero.';
    RETURN;
  END IF;

  -- Verificar si ya existen renglones
  IF EXISTS (SELECT 1 FROM public.finance_budget_line_items WHERE budget_id = v_budget_id LIMIT 1) THEN
    RAISE NOTICE '037_seed: ya existen artículos para este presupuesto. Seed omitido.';
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TIRO (22 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'TIRO', 'BLANCO ELECTRÓNICO SIUS Mod HS10 CON UNIDAD DE CONTROL Y MONITOR CU951', 2, 163900),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RIFLE DE AIRE FEINWERKBAU Mod 800x', 2, 107030),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RIFLE DE AIRE WALTHER Mod LG400 COMPETICIÓN', 2, 85360),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'PISTOLA DE AIRE STEYR Mod EVO10', 3, 77000),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'PISTOLA DE AIRE FEINWERKBAU Mod P8x', 3, 77000),
    (v_budget_id, 'Uniforme especializado','TIRO', 'TRAJE PARA TIRO (CHAMARRA PANTALÓN CORREA HANDSTOP)', 2, 18700),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'TRIPIE PARA TIRO AHG', 2, 7150),
    (v_budget_id, 'Uniforme especializado','TIRO', 'ZAPATOS PARA TIRO CON PISTOLA AHG', 3, 6600),
    (v_budget_id, 'Uniforme especializado','TIRO', 'BOTAS PARA TIRO CON RIFLE AHG', 2, 6600),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'GUANTE PARA TIRO', 2, 1500),
    (v_budget_id, 'Equipo especializado',  'TIRO', 'RODILLO PARA TIRO AHG', 2, 1425),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod R10 PISTOLA PARA TIRO DEPORTIVO', 100, 462),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod R10 RIFLE PARA TIRO DEPORTIVO', 100, 462),
    (v_budget_id, 'Insumos',              'TIRO', 'BLANCOS PARA TIRO CON PISTOLA DE AIRE KRUGER', 30, 300),
    (v_budget_id, 'Insumos',              'TIRO', 'DIÁBOLOS RWS Mod BASIC PARA TIRO DEPORTIVO', 100, 231),
    (v_budget_id, 'Insumos',              'TIRO', 'BLANCOS PARA TIRO CON RIFLE DE AIRE KRUGER', 30, 150),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Conjunto AO', 7, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Polo AO', 7, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Short AO', 7, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TIRO', 'Chamarra nilón mujer AO', 7, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- CANOTAJE (18 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'BOTE K-1, NELO', 1, 110475),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'BOTE C-1, NELO', 1, 102720),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'PALAS CANOA, BRACA EXTRA WIDE', 4, 15000),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'PALAS KAYAK, BRACA IV MÁXIMA', 4, 15000),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'CORCHOS, BRACA', 14, 1300),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'RELOJ, GARMIN', 2, 9450),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'LENTES, OAKLEY PARA SOL', 14, 4549),
    (v_budget_id, 'Equipo especializado',  'CANOTAJE', 'SIMULADORES PARA CANOTAJE, DANCPRINT. PRO', 2, 120000),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'TENIS / RUN', 14, 1999),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'PLAYERA LICRA HOMBRES', 7, 649),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'PLAYERA LICRA MUJER', 7, 599),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Conjunto AO', 15, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Polo AO', 15, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Short AO', 7, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'CANOTAJE', 'Chamarra nilón mujer AO', 7, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BÁDMINTON (11 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ASTROX 99 GAME (WHITE TIGER), YONEX RAQUETA MENÚ', 6, 3649),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ASTROX 99 GAME (WHITE TIGER), YONEX RAQUETA WOMAN', 6, 2799),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'CASCADA DRIVE BÁDMINTON (GRAY PALE GREEN), YONEX TENIS', 6, 2210),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'ROLLO BG65 TITANIUM', 6, 2300),
    (v_budget_id, 'Equipo especializado',  'BÁDMINTON', 'Lanzadera de Bádminton de plumas de pato, 12 piezas, para competición', 6, 680),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Conjunto AO', 6, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Polo AO', 7, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra licra AO', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Short AO', 6, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra nilón hombre AO', 4, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'BÁDMINTON', 'Chamarra nilón mujer AO', 2, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- JUDO (12 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'JUDO', 'Tatami Fuji Mats 2m x 1m x 4cm rojos', 40, 7100),
    (v_budget_id, 'Equipo especializado',  'JUDO', 'Tatami Fuji Mats 2m x 1m x 4cm amarillos', 32, 7100),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis mizuno aprobado IJF blanco', 10, 5500),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis mizuno aprobado IJF azul', 10, 5500),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis fuji de competencia blancos', 10, 3200),
    (v_budget_id, 'Uniforme especializado','JUDO', 'Judogis fuji de competencia azul', 10, 3200),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra nilón hombre AO', 5, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'JUDO', 'Chamarra nilón mujer AO', 5, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- KARATE (22 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','KARATE', 'Combo Black Diamond Premiere League', 11, 8040),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Onyx REV-X', 11, 5450),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Espinilleras Con Empeineras WKF (azules)', 11, 1300),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Espinilleras Con Empeineras WKF (rojas)', 11, 1300),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Nudilleras WKF / Azul', 11, 780),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Nudilleras WKF / Rojo', 11, 780),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Estilo Japonés de Algodón (azul)', 11, 280),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Estilo Japonés de Algodón (rojo)', 11, 280),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Kata Estilo Japonés (azul)', 11, 640),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Cinta Kata Estilo Japonés (rojo)', 11, 640),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal WKF', 5, 2140),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal Femenil WKF 2 en 1', 5, 2350),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector de Plástico para Pecho con tirantes', 5, 440),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Protector Corporal U14 WKF', 1, 1890),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Casco Arawaza WKF', 1, 2375),
    (v_budget_id, 'Uniforme especializado','KARATE', 'Mochila Arawaza', 11, 600),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra nilón hombre AO', 5, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'KARATE', 'Chamarra nilón mujer AO', 5, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TKD / TAEKWONDO (24 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'TKD', 'Dobok olímpico', 15, 4900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Cinta negra', 15, 450),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Espinilleras', 15, 999),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Antebraceras', 15, 910),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Suspensorio', 7, 799),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Guantes', 15, 1099),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Bucal', 15, 35),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA DOMI', 15, 3000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA PAO', 15, 1750),
    (v_budget_id, 'Equipo especializado',  'TKD', 'ASIANA PALCHAGUI DOBLE ADULTO', 15, 850),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Ligas de resistencia', 10, 900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Bandas de resistencia', 10, 900),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Petos kpnp k2 talla 3', 3, 90000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Empeineras electrónicas kpnp k2', 15, 3000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Caretas electrónicas kpnp k2 talla M', 3, 65000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Petos electrónicos daedo generación 3 talla 3', 3, 15000),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Empeineras electrónicas daedo G3', 10, 2700),
    (v_budget_id, 'Equipo especializado',  'TKD', 'Caretas electrónicas daedo talla M', 4, 14999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Conjunto AO', 15, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Polo AO', 15, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra licra AO', 15, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Short AO', 15, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra nilón hombre AO', 7, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'TKD', 'Chamarra nilón mujer AO', 8, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- GIMNASIA (11 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','GIMNASIA', 'Leotardo', 10, 1800),
    (v_budget_id, 'Equipo especializado',  'GIMNASIA', 'Traje gala', 10, 4599),
    (v_budget_id, 'Equipo especializado',  'GIMNASIA', 'Calleras para barras', 10, 1255),
    (v_budget_id, 'Uniforme especializado','GIMNASIA', 'Calleras para gimnasia', 10, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Licras', 10, 899),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Ligas / Estiramiento', 10, 855),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Conjunto AO', 12, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Polo AO', 12, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Short AO', 10, 399),
    (v_budget_id, 'Equipo / Uniforme AO', 'GIMNASIA', 'Chamarra nilón mujer AO', 12, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BREAKING (6 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Pantalón', 4, 1800),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'TENIS / RUN', 4, 4599),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Conjunto AO', 5, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Polo AO', 5, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Chamarra licra AO', 4, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BREAKING', 'Chamarra nilón mujer AO', 4, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- ATLETISMO (9 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'TENIS / RUN', 14, 3499),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'PLAYERA LICRA HOMBRES', 7, 899),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'PLAYERA LICRA MUJER', 7, 899),
    (v_budget_id, 'Uniforme especializado','ATLETISMO', 'SHORT LICRA', 7, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Conjunto AO', 25, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Polo AO', 25, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra licra AO', 25, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra nilón hombre AO', 12, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'ATLETISMO', 'Chamarra nilón mujer AO', 11, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- NATACIÓN (8 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Traje de natación', 19, 1299),
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Gorra de natación', 19, 799),
    (v_budget_id, 'Equipo especializado',  'NATACIÓN', 'Licras', 19, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Conjunto AO', 21, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Polo AO', 21, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra nilón hombre AO', 9, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'NATACIÓN', 'Chamarra nilón mujer AO', 10, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- BOX (9 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Equipo especializado',  'BOX', 'SHORT BOXEO', 8, 2499),
    (v_budget_id, 'Equipo especializado',  'BOX', 'PROTECTOR', 8, 1299),
    (v_budget_id, 'Equipo especializado',  'BOX', 'VENDAJES', 8, 1499),
    (v_budget_id, 'Equipo especializado',  'BOX', 'Calzado BOX', 8, 3200),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Conjunto AO', 10, 1199),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Polo AO', 10, 499),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra licra AO', 10, 799),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra nilón hombre AO', 9, 999),
    (v_budget_id, 'Equipo / Uniforme AO', 'BOX', 'Chamarra nilón mujer AO', 1, 2599);

  -- ─────────────────────────────────────────────────────────────────────────
  -- NUTRICIÓN (2 artículos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Insumos', 'NUTRICIÓN', 'ISOPURE 3LB', 120, 1450),
    (v_budget_id, 'Insumos', 'NUTRICIÓN', 'Gatorade® en Polvo - 1 Galón, Ponche de Frutas', 120, 115);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE AÉREO (5 destinos)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte Aéreo', 'Guadalajara, Jal. (GDL)', 'Avión (Boleto Ida y Vuelta)', 1, 3500),
    (v_budget_id, 'Transporte Aéreo', 'Monterrey, N.L. (MTY)',   'Avión (Boleto Ida y Vuelta)', 1, 3500),
    (v_budget_id, 'Transporte Aéreo', 'Tijuana, B.C. (TIJ)',     'Avión (Boleto Ida y Vuelta)', 1, 5500),
    (v_budget_id, 'Transporte Aéreo', 'Mérida, Yuc. (MER)',      'Avión (Boleto Ida y Vuelta)', 1, 5500),
    (v_budget_id, 'Transporte Aéreo', 'Veracruz, Ver. (VER)',    'Avión (Boleto Ida y Vuelta)', 1, 4000);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE TERRESTRE DEDICADO (8 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte terrestre (Ded)', 'León, Gto.',          'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 3190),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Puebla, Pue.',        'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1210),
    (v_budget_id, 'Transporte terrestre (Ded)', 'CDMX (COM)',          'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 770),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Progreso, Yuc.',      'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 10802),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Acapulco, Gro.',      'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 3795),
    (v_budget_id, 'Transporte terrestre (Ded)', 'CDMX',                'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1540),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Guadalajara, Jal.',   'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 4686),
    (v_budget_id, 'Transporte terrestre (Ded)', 'Tlaxcala, Tlax.',     'Unidad completa (Servicio Ida / Vuelta / 20 personas)', 20, 1155);

  -- ─────────────────────────────────────────────────────────────────────────
  -- TRANSPORTE TERRESTRE ADO (6 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Transporte terrestre (ADO)', 'León, Gto.',        'Camión (Boleto Ida y Vuelta)', 1, 2150),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Puebla, Pue.',      'Camión (Boleto Ida y Vuelta)', 1, 850),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Progreso, Yuc.',    'Camión (Boleto Ida y Vuelta)', 1, 4650),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Acapulco, Gro.',    'Camión (Boleto Ida y Vuelta)', 1, 1065),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Guadalajara, Jal.', 'Camión (Boleto Ida y Vuelta)', 1, 2850),
    (v_budget_id, 'Transporte terrestre (ADO)', 'Tlaxcala, Tlax.',   'Camión (Boleto Ida y Vuelta)', 1, 1975);

  -- ─────────────────────────────────────────────────────────────────────────
  -- HOSPEDAJE (7 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Hospedaje', 'León, Gto.',         'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Monterrey, N.L.',    'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1700),
    (v_budget_id, 'Hospedaje', 'Puebla, Pue.',       'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Progreso, Yuc.',     'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Acapulco, Gro.',     'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Guadalajara, Jal.',  'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500),
    (v_budget_id, 'Hospedaje', 'Tlaxcala, Tlax.',    'Hotel ONE / City Express (habitación sencilla/noche)', 1, 1500);

  -- ─────────────────────────────────────────────────────────────────────────
  -- VIÁTICOS (7 ciudades)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.finance_budget_line_items (budget_id, tipo_equipo, disciplina, articulo, unidades, precio_unitario) VALUES
    (v_budget_id, 'Viáticos', 'León, Gto.',         'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Monterrey, N.L.',    'Viático diario (alimentación y movilidad)', 1, 700),
    (v_budget_id, 'Viáticos', 'Puebla, Pue.',       'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Progreso, Yuc.',     'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Acapulco, Gro.',     'Viático diario (alimentación y movilidad)', 1, 600),
    (v_budget_id, 'Viáticos', 'Guadalajara, Jal.',  'Viático diario (alimentación y movilidad)', 1, 500),
    (v_budget_id, 'Viáticos', 'Tlaxcala, Tlax.',    'Viático diario (alimentación y movilidad)', 1, 500);

  RAISE NOTICE '037_seed: % artículos sembrados para el presupuesto Obregonense 2026.',
    (SELECT COUNT(*) FROM public.finance_budget_line_items WHERE budget_id = v_budget_id);

END $$;
