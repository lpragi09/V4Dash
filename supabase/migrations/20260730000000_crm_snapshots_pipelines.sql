-- Guarda a lista de funis (pipelines) do Kommo no snapshot, pra permitir
-- filtrar o dashboard de CRM por funil quando o cliente tem mais de um.
ALTER TABLE public.crm_snapshots
  ADD COLUMN IF NOT EXISTS pipelines JSONB NOT NULL DEFAULT '[]'::jsonb;
