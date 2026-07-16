ALTER TABLE public.vendor_commissions
  ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(18,2) DEFAULT 0;
