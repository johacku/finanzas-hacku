-- Item configuration: which Alegra items are active + commission ranges
CREATE TABLE public.item_commission_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alegra_item_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT item_config_alegra_id_unique UNIQUE (alegra_item_id)
);

-- Commission ranges per item
-- Example: item "Licencias PRO" from $0-$500 = 3%, $501-$2000 = 5%, $2001+ = 8%
CREATE TABLE public.item_commission_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_config_id UUID NOT NULL REFERENCES public.item_commission_config(id) ON DELETE CASCADE,
  precio_desde NUMERIC(18,2) NOT NULL DEFAULT 0,
  precio_hasta NUMERIC(18,2),  -- NULL = unlimited
  porcentaje_comision NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ranges_item ON public.item_commission_ranges(item_config_id);

CREATE TRIGGER item_config_updated_at
  BEFORE UPDATE ON public.item_commission_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.item_commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_commission_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_item_config" ON public.item_commission_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_item_ranges" ON public.item_commission_ranges FOR ALL TO authenticated USING (true) WITH CHECK (true);
