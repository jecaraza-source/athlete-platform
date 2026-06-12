-- =============================================================================
-- 041_supplier_payment_attachments.sql
--
-- Tablas de adjuntos para proveedores y pagos.
--   finance_supplier_attachments — CSF, contratos, documentos del proveedor
--   finance_payment_attachments  — comprobantes de pago, facturas pagadas
-- =============================================================================

-- ── Adjuntos de proveedor ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_supplier_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID          NOT NULL REFERENCES public.finance_suppliers(id) ON DELETE CASCADE,
  -- 'csf'=Constancia de Situación Fiscal, 'document'=Documento general
  attachment_type     TEXT          NOT NULL DEFAULT 'document'
                      CHECK (attachment_type IN ('csf', 'document')),
  file_name_original  TEXT          NOT NULL,
  file_name_storage   TEXT          NOT NULL,
  file_path           TEXT          NOT NULL,
  mime_type           TEXT          NOT NULL,
  file_extension      TEXT          NOT NULL,
  file_size           BIGINT        NOT NULL,
  description         TEXT,
  uploaded_by         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  deleted_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fsa_supplier
  ON public.finance_supplier_attachments(supplier_id, is_active, attachment_type);

-- ── Adjuntos de pago ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_payment_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          UUID          NOT NULL REFERENCES public.finance_payments(id) ON DELETE CASCADE,
  file_name_original  TEXT          NOT NULL,
  file_name_storage   TEXT          NOT NULL,
  file_path           TEXT          NOT NULL,
  mime_type           TEXT          NOT NULL,
  file_extension      TEXT          NOT NULL,
  file_size           BIGINT        NOT NULL,
  description         TEXT,
  uploaded_by         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  deleted_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fpa_payment
  ON public.finance_payment_attachments(payment_id, is_active);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.finance_supplier_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_attachments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can read supplier attachments"
  ON public.finance_supplier_attachments FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );

CREATE POLICY "Finance roles can read payment attachments"
  ON public.finance_payment_attachments FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND r.code IN ('super_admin', 'admin', 'program_director', 'finance_admin')
    )
  );
