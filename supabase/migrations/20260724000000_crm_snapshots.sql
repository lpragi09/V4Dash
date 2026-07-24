-- Snapshot diário dos leads do Kommo por cliente. Antes, cada carregamento de
-- página buscava tudo direto na API do Kommo (e isso estourava rate limit
-- quando várias abas abriam ao mesmo tempo). Agora um cron roda uma vez por
-- dia, busca os leads e grava aqui; as páginas de dashboard só leem essa tabela.
CREATE TABLE public.crm_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,

    -- Histórico inteiro de leads (até o teto de paginação), usado nos totais gerais.
    leads JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Últimos ~31 dias, buscado com filtro direto na API do Kommo — garante
    -- que os recortes de 7d/30d fiquem completos mesmo se "leads" for truncado
    -- pelo teto de paginação em contas com muito histórico.
    recent_leads JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- status_id do(s) estágio(s) "Não Fechou" do funil (customizado por conta).
    nao_fechou_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo em crm_snapshots" ON public.crm_snapshots FOR ALL USING (true);
