-- Migration 040: Atomic liability movement RPC
--
-- Provides a plpgsql function that performs the balance read-modify-write and
-- movement insert in a single transaction with a row-level lock, eliminating
-- the race condition present in the JS read-then-write pattern.
--
-- Usage from Supabase-JS:
--   supabase.rpc('record_liability_movement', {
--     p_liability_id:    '<uuid>',
--     p_fecha_movimiento:'YYYY-MM-DD',
--     p_tipo_movimiento: 'draw' | 'payment' | 'interest_charge',
--     p_monto:            123.45,
--     p_descripcion:     'optional note',
--   })
-- Returns: the newly-inserted liability_movements row (JSON).

CREATE OR REPLACE FUNCTION public.record_liability_movement(
  p_liability_id    UUID,
  p_fecha_movimiento TEXT,
  p_tipo_movimiento  TEXT,
  p_monto           NUMERIC,
  p_descripcion     TEXT DEFAULT NULL
)
RETURNS SETOF public.liability_movements
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_balance   NUMERIC;
  v_new_balance   NUMERIC;
  v_movement_row  public.liability_movements;
BEGIN
  -- Lock the liability row for the duration of this transaction so that
  -- concurrent calls cannot read a stale balance before we write back.
  SELECT monto_disponible
    INTO v_old_balance
    FROM public.financial_liabilities
   WHERE id = p_liability_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liability % not found', p_liability_id;
  END IF;

  v_old_balance := COALESCE(v_old_balance, 0);
  v_new_balance := v_old_balance;

  -- Adjust balance based on movement type
  IF p_tipo_movimiento = 'draw' THEN
    v_new_balance := v_old_balance - p_monto;
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient available balance for draw (available: %, requested: %)',
        v_old_balance, p_monto;
    END IF;
  ELSIF p_tipo_movimiento = 'payment' THEN
    v_new_balance := v_old_balance + p_monto;
  ELSIF p_tipo_movimiento = 'interest_charge' THEN
    v_new_balance := v_old_balance - p_monto;
  ELSE
    RAISE EXCEPTION 'Unknown tipo_movimiento: %', p_tipo_movimiento;
  END IF;

  -- Update the liability balance atomically within this transaction
  UPDATE public.financial_liabilities
     SET monto_disponible = v_new_balance,
         updated_at       = NOW()
   WHERE id = p_liability_id;

  -- Insert movement row and return it
  INSERT INTO public.liability_movements (
    liability_id,
    fecha_movimiento,
    tipo_movimiento,
    monto,
    descripcion,
    balance_despues
  ) VALUES (
    p_liability_id,
    p_fecha_movimiento::DATE,
    p_tipo_movimiento,
    p_monto,
    p_descripcion,
    v_new_balance
  )
  RETURNING * INTO v_movement_row;

  RETURN NEXT v_movement_row;
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on new functions. Since this is a
-- SECURITY DEFINER function that bypasses RLS, we must strip the default PUBLIC/anon
-- grant so the anon key cannot move liability balances without authentication.
REVOKE EXECUTE ON FUNCTION public.record_liability_movement(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_liability_movement(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;

-- Grant execute to authenticated role (matching RLS policy on other tables)
GRANT EXECUTE ON FUNCTION public.record_liability_movement(UUID, TEXT, TEXT, NUMERIC, TEXT)
  TO authenticated;
