-- Migration 043: Hunter originador a nivel de cliente (1% recurrente perpetuo)
--
-- El 1% de la facturación recurrente sigue al Hunter que ORIGINÓ el cliente
-- (desde el 2º mes, a perpetuidad), aunque después la cuenta la gestione un KAM.
-- Esta atribución debe vivir en el cliente, no en la factura ni en el rol del
-- vendedor. Ver specs/001-comisiones-por-origen (US3/US4, ADR-3).
--
-- es_negocio_nuevo_originado=false => no se genera el 1% (excepción cuenta
-- existente con facturación previa, FR-009).
--
-- Idempotente. Aplicar vía `supabase db query`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hacku_clientes' AND column_name='hunter_originador_id') THEN
    ALTER TABLE public.hacku_clientes ADD COLUMN hunter_originador_id uuid REFERENCES public.vendedores(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hacku_clientes' AND column_name='es_negocio_nuevo_originado') THEN
    ALTER TABLE public.hacku_clientes ADD COLUMN es_negocio_nuevo_originado boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hacku_clientes_hunter_originador
  ON public.hacku_clientes(hunter_originador_id);
