import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  Search,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Activity,
  Settings,
  Eye,
  Percent
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function GoogleAdsClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) notFound();

  // Busca a integração do Google Ads
  const { data: googleInt } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'google_ads')
    .single();

  const googleAccountId = googleInt?.conta_id;
  const accessToken = googleInt?.access_token;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  let dashboardData = null;
  let fetchError = null;

  if (!googleAccountId) {
    fetchError = "Conta do Google Ads não vinculada a este cliente. Configure em Configurações Gerais.";
  } else if (!accessToken) {
    fetchError = "Cliente não conectou o Google Ads (Access Token ausente).";
  } else if (!developerToken) {
    fetchError = "Token de Desenvolvedor do Google Ads (GOOGLE_ADS_DEVELOPER_TOKEN) não configurado no servidor.";
  } else {
    try {
      const customerId = googleAccountId.replace(/-/g, '');
      const query = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc FROM customer WHERE segments.date DURING LAST_30_DAYS`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      };
      if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
        headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
      }

      const res = await fetch(`https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
        cache: 'no-store',
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error?.message || `Erro na API do Google Ads (${res.status})`);
      }

      const metrics = body.results?.[0]?.metrics;
      const spend = metrics ? Number(metrics.costMicros || 0) / 1_000_000 : 0;
      const leads = metrics ? Number(metrics.conversions || 0) : 0;

      dashboardData = {
        gastos: spend,
        leads,
        cliques: metrics ? Number(metrics.clicks || 0) : 0,
        cpl: leads > 0 ? spend / leads : 0,
        impressoes: metrics ? Number(metrics.impressions || 0) : 0,
        ctr: metrics ? Number(metrics.ctr || 0) * 100 : 0,
        cpcMedio: metrics ? Number(metrics.averageCpc || 0) / 1_000_000 : 0,
      };
    } catch (err) {
      dashboardData = null;
      fetchError = err instanceof Error ? err.message : "Erro ao conectar com a API do Google Ads.";
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Search className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração Google Ads</h1>
          <p className="text-zinc-400">Desempenho de campanhas de {client.nome}</p>
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
          {!googleAccountId && (
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
                Gastos (Google)
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.gastos)}</p>
            </div>
            
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Leads (Google)
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
                Cliques
                <Activity className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.cliques}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Impressões
                <Eye className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.impressoes}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                CTR
                <Percent className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.ctr.toFixed(2)}%</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                CPC Médio
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpcMedio)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
