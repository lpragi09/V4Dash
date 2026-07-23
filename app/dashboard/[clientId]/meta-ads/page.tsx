import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Settings,
  Eye,
  Radar,
  Repeat,
  Percent
} from 'lucide-react';
import Link from 'next/link';
import TrendChart from '@/components/TrendChart';
import InfoTooltip from '@/components/InfoTooltip';
import ComparisonBadge from '@/components/ComparisonBadge';
import { getValidAgencyMetaToken } from '@/lib/meta-agency';

export const dynamic = 'force-dynamic';

interface MetaDailyInsight {
  date_start: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
}

interface MetaAggregate {
  gastos: number;
  leads: number;
  cliques: number;
  cpl: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  ctr: number;
  cpm: number;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(fmtDate(d));
  }
  return dates;
}

/** Preenche com 0 os dias sem retorno da API, pra série sempre ir até hoje. */
function alignSeries(dates: string[], rows: { date: string; value: number }[]): { date: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.date, r.value]));
  return dates.map((d) => ({ date: d, value: map.get(d) || 0 }));
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

async function fetchMetaAggregate(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaAggregate> {
  const fields = 'spend,clicks,impressions,reach,frequency,ctr,cpm,actions';
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&fields=${fields}`;
  const response = await fetch(url, { cache: 'no-store' });
  const responseData = await response.json();

  if (responseData.error) {
    throw new Error(responseData.error.message || 'Erro na Graph API do Meta');
  }

  const insights = responseData.data && responseData.data.length > 0 ? responseData.data[0] : null;

  let leadsCount = 0;
  if (insights?.actions) {
    const leadAction = (insights.actions as { action_type: string; value: string }[]).find((a) => a.action_type === 'lead');
    if (leadAction) leadsCount = parseInt(leadAction.value, 10);
  }

  const spend = insights ? parseFloat(insights.spend || '0') : 0;

  return {
    gastos: spend,
    leads: leadsCount,
    cliques: insights ? parseInt(insights.clicks || '0', 10) : 0,
    cpl: leadsCount > 0 ? spend / leadsCount : 0,
    impressoes: insights ? parseInt(insights.impressions || '0', 10) : 0,
    alcance: insights ? parseInt(insights.reach || '0', 10) : 0,
    frequencia: insights ? parseFloat(insights.frequency || '0') : 0,
    ctr: insights ? parseFloat(insights.ctr || '0') : 0,
    cpm: insights ? parseFloat(insights.cpm || '0') : 0,
  };
}

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
  const accessToken = await getValidAgencyMetaToken(supabase);

  let dashboardData: MetaAggregate | null = null;
  let previousData: MetaAggregate | null = null;
  let fetchError = null;
  let dailySpend: { date: string; value: number }[] = [];
  let dailyLeads: { date: string; value: number }[] = [];

  if (!accessToken) {
    fetchError = "Meta Ads não autorizado pela agência. Autorize em Configurações Gerais.";
  } else if (!metaAccountId) {
    fetchError = "Nenhuma conta de anúncios foi selecionada para este cliente. Escolha uma conta em Configurações Gerais.";
  } else {
    try {
      const normalizedAccountId = metaAccountId.startsWith('act_') ? metaAccountId : `act_${metaAccountId}`;
      const { current, previous } = getPeriods();
      const dailyUrl = `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&date_preset=last_30d&time_increment=1&fields=spend,actions`;

      // Período atual, período anterior e série diária são independentes —
      // buscados em paralelo em vez de um esperar o outro terminar.
      const [currentSettled, previousSettled, dailySettled] = await Promise.allSettled([
        fetchMetaAggregate(normalizedAccountId, accessToken, current),
        fetchMetaAggregate(normalizedAccountId, accessToken, previous),
        fetch(dailyUrl, { cache: 'no-store' }).then((r) => r.json()),
      ]);

      if (currentSettled.status === 'fulfilled') {
        dashboardData = currentSettled.value;
      } else {
        throw currentSettled.reason;
      }

      if (previousSettled.status === 'fulfilled') {
        previousData = previousSettled.value;
      } else {
        console.error('Error fetching previous period Meta Ads:', previousSettled.reason);
      }

      if (dailySettled.status === 'fulfilled') {
        const dailyRows: MetaDailyInsight[] = dailySettled.value.data || [];
        const dateRange = lastNDates(30);
        dailySpend = alignSeries(
          dateRange,
          dailyRows.map((row) => ({ date: row.date_start, value: parseFloat(row.spend || '0') }))
        );
        dailyLeads = alignSeries(
          dateRange,
          dailyRows.map((row) => {
            const leadAction = row.actions?.find((a) => a.action_type === 'lead');
            return { date: row.date_start, value: leadAction ? parseInt(leadAction.value, 10) : 0 };
          })
        );
      } else {
        console.error('Error fetching daily Meta Ads series:', dailySettled.reason);
      }
    } catch (err) {
      dashboardData = null;
      fetchError = err instanceof Error ? err.message : "Erro ao conectar com a API do Meta Ads.";
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
          {(!accessToken || !metaAccountId) && (
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
                  Gasto Total
                  <InfoTooltip text="Valor total investido em anúncios no Meta (Facebook e Instagram) no período." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.gastos)}</p>
              {previousData && <ComparisonBadge current={dashboardData.gastos} previous={previousData.gastos} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Leads
                  <InfoTooltip text="Número de leads gerados através dos formulários e ações de conversão configuradas nas campanhas." />
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
                  <InfoTooltip text="Gasto total dividido pelo número de leads gerados (CPL)." />
                </span>
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpl)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpl} previous={previousData.cpl} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Cliques no Link
                  <InfoTooltip text="Quantidade de cliques nos links dos anúncios." />
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
                  Alcance
                  <InfoTooltip text="Número de pessoas únicas que viram os anúncios." />
                </span>
                <Radar className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.alcance}</p>
              {previousData && <ComparisonBadge current={dashboardData.alcance} previous={previousData.alcance} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Frequência
                  <InfoTooltip text="Média de vezes que cada pessoa viu o anúncio (Impressões ÷ Alcance)." />
                </span>
                <Repeat className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.frequencia.toFixed(2)}</p>
              {previousData && <ComparisonBadge current={dashboardData.frequencia} previous={previousData.frequencia} />}
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
                  CPM
                  <InfoTooltip text="Custo por mil impressões." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpm)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpm} previous={previousData.cpm} invert />}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Gasto Diário</h3>
              <TrendChart
                series={[{ name: 'Gasto', color: 'blue', points: dailySpend }]}
                format="currency"
              />
            </div>
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Leads Diários</h3>
              <TrendChart series={[{ name: 'Leads', color: 'blue', points: dailyLeads }]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
