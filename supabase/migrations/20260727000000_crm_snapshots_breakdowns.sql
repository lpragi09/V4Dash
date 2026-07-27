-- Guarda também os motivos de perda e a lista de usuários (responsáveis) do
-- Kommo no snapshot, pra montar os breakdowns de "Motivos de Perda" e
-- "Performance por Responsável" sem precisar buscar isso de novo a cada acesso.
ALTER TABLE public.crm_snapshots
  ADD COLUMN IF NOT EXISTS loss_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS users JSONB NOT NULL DEFAULT '[]'::jsonb;
