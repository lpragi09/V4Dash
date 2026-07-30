-- O Kommo expira o access_token em ~24h e não existia nenhum controle de
-- validade nem renovação — a sincronização diária do CRM vinha falhando
-- silenciosamente (401/"Unauthorized") pra qualquer cliente conectado há
-- mais de 24h, e o snapshot ficava parado sem ninguém perceber.
ALTER TABLE public.integracoes_clientes
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;
