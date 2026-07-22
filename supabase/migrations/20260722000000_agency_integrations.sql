-- Integrações compartilhadas pela agência inteira (não por cliente).
-- Uso inicial: autorização única do Google Ads via MCC — em vez de cada
-- cliente autorizar individualmente, a agência autoriza uma vez e escolhe,
-- por cliente, qual conta (customer_client) da MCC usar.
CREATE TABLE public.integracoes_agencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plataforma TEXT NOT NULL UNIQUE,

    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,

    configuracoes_extras JSONB DEFAULT '{}'::jsonb,

    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.integracoes_agencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo em integracoes_agencia" ON public.integracoes_agencia FOR ALL USING (true);

CREATE TRIGGER integracoes_agencia_updated_at
    BEFORE UPDATE ON public.integracoes_agencia
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
