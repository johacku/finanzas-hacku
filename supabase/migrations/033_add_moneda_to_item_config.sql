ALTER TABLE public.item_commission_config ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'COP';
ALTER TABLE public.item_commission_config ADD COLUMN IF NOT EXISTS precio_default NUMERIC(18,2);
