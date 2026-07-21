-- O código do app grava a integração do Kommo com plataforma = 'crm',
-- mas a constraint original só permitia 'meta_ads' | 'google_ads' | 'kommo'.
-- Sem isso, toda tentativa de conectar o Kommo falha com violação de CHECK.
ALTER TABLE public.integracoes_clientes
  DROP CONSTRAINT integracoes_clientes_plataforma_check;

ALTER TABLE public.integracoes_clientes
  ADD CONSTRAINT integracoes_clientes_plataforma_check
  CHECK (plataforma IN ('meta_ads', 'google_ads', 'kommo', 'crm'));
