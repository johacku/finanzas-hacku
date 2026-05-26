-- Migration 021: Add EUR to currency_pair enum
ALTER TYPE public.currency_pair ADD VALUE IF NOT EXISTS 'USDEUR';
