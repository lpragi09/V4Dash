import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { 
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Settings
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MetaAdsClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) notFound();

  // Busca a integração do Meta Ads
  const { data: metaInt } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'meta_ads')
    .single();

  const metaAccountId = metaInt?.conta_id;
  const accessToken = metaInt?.access_token;

  let dashboardData = null;
  let fetchError = null;

  if (!metaAccountId) {
    fetchError = "Conta de anúncios do Meta não vinculada a este cliente. Configure em Configurações Gerais.";
  } else if (!accessToken) {
    fetchError = "Token de Acesso do Meta (META_ACCESS_TOKEN) não configurado no servidor.";
  } else {
    try {
      // Faz a chamada real para a Graph API do Meta (Insights dos últimos 30 dias)
      const normalizedAccountId = metaAccountId.startsWith('act_') ? metaAccountId : `act_${metaAccountId}`;
      const url = `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&date_preset=last_30d&fields=spend,clicks,actions`;
      const response = await fetch(url, { cache: 'no-store' });
      const responseData = await response.json();
      
      if (responseData.error) {
        throw new Error(responseData.error.message || "Erro na Graph API do Meta");
      }

      // Processa os dados
      // Se não houver dados no período, os valores serão 0
      const insights = responseData.data && responseData.data.length > 0 ? responseData.data[0] : null;
      
      let leadsCount = 0;
      if (insights && insights.actions) {
        // 'lead' é o action_type padrão, mas dependendo da conversão pode ser outro
        const leadAction = insights.actions.find((a: any) => a.action_type === 'lead');
        if (leadAction) leadsCount = parseInt(leadAction.value);
      }

      const spend = insights ? parseFloat(insights.spend || '0') : 0;
      const clicks = insights ? parseInt(insights.clicks || '0') : 0;
      const cpl = leadsCount > 0 ? (spend / leadsCount) : 0;

      dashboardData = {
        gastos: spend,
        leads: leadsCount,
        cliques: clicks,
        cpl: cpl
      };

    } catch (err: any) {
      dashboardData = null;
      fetchError = err.message || "Erro ao conectar com a API do Meta Ads.";
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Activity className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração Meta Ads</h1>
          <p className="text-zinc-400">Desempenho de campanhas de {client.nome} (Últimos 30 dias)</p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-2xl p-6 flex flex-col items-start gap-4">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="text-red-400 font-bold text-lg mb-1">Ação Necessária</h3>
              <p className="text-red-200/70">{fetchError}</p>
            </div>
          </div>
          {!metaAccountId && (
             <Link href="/dashboard/settings" className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
               <Settings className="w-4 h-4" />
               Vincular Conta em Configurações
             </Link>
          )}
        </div>
      )}

      {dashboardData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Gasto Total
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.gastos)}</p>
            </div>
            
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Leads
                <Users className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.leads}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Custo por Lead
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpl)}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Cliques no Link
                <Activity className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.cliques}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
