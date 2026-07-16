-- Schema base para o Sistema Admin da Agência

-- Tabela de Clientes
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pausado')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Integrações (Armazena as configurações de API para cada cliente)
CREATE TABLE public.integracoes_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('meta_ads', 'google_ads', 'kommo')),
    
    -- ID da conta específica na plataforma (ex: act_123456 para Meta, 123-456-7890 para Google Ads)
    conta_id TEXT, 
    
    -- Tokens de acesso (Se a autenticação for por cliente. Se for conta mestre da agência, 
    -- usamos a variável de ambiente do painel e usamos esta tabela apenas para mapear o conta_id)
    access_token TEXT,
    refresh_token TEXT,
    
    -- Informações adicionais em JSON (ex: id da página do facebook, etc)
    configuracoes_extras JSONB DEFAULT '{}'::jsonb,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Cada cliente só deve ter um registro por plataforma
    UNIQUE(cliente_id, plataforma)
);

-- Habilitar RLS (Row Level Security) - Por enquanto, vamos deixar liberado apenas para chamadas
-- feitas com a chave de serviço (Service Role) no backend, ou anon se não houver auth.
-- Se formos criar um login para a agência entrar no painel Admin, configuramos as políticas depois.
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas temporárias para permitir acesso total para desenvolvimento (cuidado em produção)
CREATE POLICY "Permitir tudo em clientes" ON public.clientes FOR ALL USING (true);
CREATE POLICY "Permitir tudo em integracoes" ON public.integracoes_clientes FOR ALL USING (true);

-- Função para atualizar o `atualizado_em` automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integracoes_clientes_updated_at
    BEFORE UPDATE ON public.integracoes_clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
