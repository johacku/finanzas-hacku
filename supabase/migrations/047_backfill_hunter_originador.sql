-- Migration 047: Backfill hunter_originador_id para clientes existentes
--
-- Migración 043 añadió es_negocio_nuevo_originado=false para todos los
-- hacku_clientes existentes. La lógica vieja pagaba 1% por vendedor.rol='Hunter'.
-- Este backfill restaura el campo para los clientes cuyas facturas históricas
-- tuvieron un vendedor con rol='Hunter'.
--
-- Regla: para cada hacku_cliente sin hunter_originador_id asignado, busca la
-- factura MÁS ANTIGUA donde el vendedor tenga rol='Hunter' (join por nombre, ya
-- que las facturas históricas no tienen vendedor_id FK). Si se encuentra, setea
-- hunter_originador_id y es_negocio_nuevo_originado=true.
--
-- NO sobreescribe un originador ya asignado (WHERE hunter_originador_id IS NULL).
-- Idempotente por esa cláusula.

DO $$
DECLARE
  v_updated integer := 0;
  v_rec record;
BEGIN
  -- Para cada hacku_cliente sin originador asignado
  FOR v_rec IN
    SELECT
      hc.id AS hacku_cliente_id,
      hc.nombre AS hacku_cliente_nombre,
      v.id AS vendedor_id
    FROM public.hacku_clientes hc
    -- Factura más antigua del cliente con un vendedor Hunter
    JOIN LATERAL (
      SELECT inv.vendedor, inv.fecha_creacion
      FROM public.income_invoices inv
      WHERE inv.hacku_cliente = hc.nombre   -- join por nombre (facturas históricas)
        AND inv.vendedor IS NOT NULL
      ORDER BY inv.fecha_creacion ASC
      LIMIT 1
    ) primera_factura ON true
    -- Resolución de vendedor_id desde la tabla vendedores por nombre (rol = Hunter)
    JOIN public.vendedores v
      ON v.nombre = primera_factura.vendedor
     AND v.rol = 'Hunter'
    WHERE hc.hunter_originador_id IS NULL   -- no sobreescribir
  LOOP
    UPDATE public.hacku_clientes
    SET
      hunter_originador_id   = v_rec.vendedor_id,
      es_negocio_nuevo_originado = true
    WHERE id = v_rec.hacku_cliente_id;

    v_updated := v_updated + 1;
  END LOOP;

  RAISE NOTICE 'Backfill 047: % hacku_clientes actualizados con hunter_originador_id', v_updated;
END $$;
