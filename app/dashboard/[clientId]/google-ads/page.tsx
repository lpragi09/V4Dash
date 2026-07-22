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
import TrendChart from '@/components/TrendChart';
import InfoTooltip from '@/components/InfoTooltip';
import ComparisonBadge from '@/components/ComparisonBadge';
import { getValidAgencyGoogleToken } from '@/lib/google-agency';

export const dynamic = 'force-dynamic';

interface GoogleDailyRow {
  segments?: { date?: string };
  metrics?: { costMicros?: string | number; clicks?: string | number };
}

interface GoogleAggregate {
  gastos: number;
  leads: number;
  cliques: number;
  cpl: number;
  impressoes: number;
  ctr: number;
  cpcMedio: number;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Janela dos últimos 30 dias (incluindo hoje) e os 30 dias imediatamente anteriores. */
function getPeriods() {
  const currentUntil = new Date();
  const currentSince = new Date();
  currentSince.setDate(currentSince.getDate() - 29);

  const previousUntil = new Date();
  previousUntil.setDate(previousUntil.getDate() - 30);
  const previousSince = new Date();
  previousSince.setDate(previousSince.getDate() - 59);

  return {
    current: { since: fmtDate(currentSince), until: fmtDate(currentUntil) },
    previous: { since: fmtDate(previousSince), until: fmtDate(previousUntil) },
  };
}

async function fetchGoogleAggregate(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleAggregate> {
  const query = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc FROM customer WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;

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

  return {
    gastos: spend,
    leads,
    cliques: metrics ? Number(metrics.clicks || 0) : 0,
    cpl: leads > 0 ? spend / leads : 0,
    impressoes: metrics ? Number(metrics.impressions || 0) : 0,
    ctr: metrics ? Number(metrics.ctr || 0) * 100 : 0,
    cpcMedio: metrics ? Number(metrics.averageCpc || 0) / 1_000_000 : 0,
  };
}

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
  const accessToken = await getValidAgencyGoogleToken(supabase);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  let dashboardData: GoogleAggregate | null = null;
  let previousData: GoogleAggregate | null = null;
  let fetchError = null;
  let dailySpend: { date: string; value: number }[] = [];
  let dailyClicks: { date: string; value: number }[] = [];

  if (!accessToken) {
    fetchError = "Google Ads não autorizado pela agência. Autorize em Configurações Gerais.";
  } else if (!googleAccountId) {
    fetchError = "Nenhuma conta de anúncios foi selecionada para este cliente. Escolha uma conta em Configurações Gerais.";
  } else if (!developerToken) {
    fetchError = "Token de Desenvolvedor do Google Ads (GOOGLE_ADS_DEVELOPER_TOKEN) não configurado no servidor.";
  } else {
    try {
      const customerId = googleAccountId.replace(/-/g, '');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      };
      if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
        headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
      }

      const { current, previous } = getPeriods();
      const dailyQuery = `SELECT segments.date, metrics.clicks, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${current.since}' AND '${current.until}' ORDER BY segments.date ASC`;

      // Período atual, período anterior e série diária são independentes —
      // buscados em paralelo em vez de um esperar o outro terminar.
      const [currentSettled, previousSettled, dailySettled] = await Promise.allSettled([
        fetchGoogleAggregate(customerId, headers, current),
        fetchGoogleAggregate(customerId, headers, previous),
        fetch(`https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: dailyQuery }),
          cache: 'no-store',
        }).then((r) => r.json()),
      ]);

      if (currentSettled.status === 'fulfilled') {
        dashboardData = currentSettled.value;
      } else {
        throw currentSettled.reason;
      }

      if (previousSettled.status === 'fulfilled') {
        previousData = previousSettled.value;
      } else {
        console.error('Error fetching previous period Google Ads:', previousSettled.reason);
      }

      if (dailySettled.status === 'fulfilled') {
        const dailyRows: GoogleDailyRow[] = dailySettled.value.results || [];
        dailySpend = dailyRows
          .filter((row) => row.segments?.date)
          .map((row) => ({
            date: row.segments!.date!,
            value: Number(row.metrics?.costMicros || 0) / 1_000_000,
          }));
        dailyClicks = dailyRows
          .filter((row) => row.segments?.date)
          .map((row) => ({ date: row.segments!.date!, value: Number(row.metrics?.clicks || 0) }));
      } else {
        console.error('Error fetching daily Google Ads series:', dailySettled.reason);
      }
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
          {(!accessToken || !googleAccountId) && (
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
                <span className="flex items-center gap-1.5">
                  Gastos (Google)
                  <InfoTooltip text="Valor total investido em campanhas do Google Ads no período." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.gastos)}</p>
              {previousData && <ComparisonBadge current={dashboardData.gastos} previous={previousData.gastos} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Leads (Google)
                  <InfoTooltip text="Número de conversões registradas nas campanhas do Google Ads." />
                </span>
                <Users className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.leads}</p>
              {previousData && <ComparisonBadge current={dashboardData.leads} previous={previousData.leads} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Custo por Lead
                  <InfoTooltip text="Gasto total dividido pelo número de conversões geradas (CPL)." />
                </span>
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpl)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpl} previous={previousData.cpl} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Cliques
                  <InfoTooltip text="Quantidade de cliques nos anúncios do Google Ads." />
                </span>
                <Activity className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.cliques}</p>
              {previousData && <ComparisonBadge current={dashboardData.cliques} previous={previousData.cliques} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Impressões
                  <InfoTooltip text="Número de vezes que os anúncios foram exibidos." />
                </span>
                <Eye className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.impressoes}</p>
              {previousData && <ComparisonBadge current={dashboardData.impressoes} previous={previousData.impressoes} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  CTR
                  <InfoTooltip text="Taxa de cliques: percentual de impressões que resultaram em clique." />
                </span>
                <Percent className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.ctr.toFixed(2)}%</p>
              {previousData && <ComparisonBadge current={dashboardData.ctr} previous={previousData.ctr} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  CPC Médio
                  <InfoTooltip text="Valor médio pago por clique." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpcMedio)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpcMedio} previous={previousData.cpcMedio} invert />}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Gasto Diário</h3>
              <TrendChart
                series={[{ name: 'Gasto', color: 'emerald', points: dailySpend }]}
                format="currency"
              />
            </div>
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Cliques Diários</h3>
              <TrendChart series={[{ name: 'Cliques', color: 'emerald', points: dailyClicks }]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
