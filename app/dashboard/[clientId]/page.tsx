import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import TrendChart from '@/components/TrendChart';
import InfoTooltip from '@/components/InfoTooltip';
import ComparisonBadge from '@/components/ComparisonBadge';
import { getValidAgencyGoogleToken } from '@/lib/google-agency';

// Force dynamic since it depends on params
export const dynamic = 'force-dynamic';

interface KommoLead {
  status_id: number;
  price?: number;
}

interface ChannelAggregate {
  gastos: number;
  leads: number;
  cpl: number;
}

interface CrmAggregate {
  oportunidades: number;
  ganhas: number;
  perdidas: number;
  valorGanho: number;
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function alignSeries(dates: string[], rows: { date: string; value: number }[]): { date: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.date, r.value]));
  return dates.map((d) => ({ date: d, value: map.get(d) || 0 }));
}

/** Os 30 dias imediatamente anteriores à janela atual (últimos 30 dias), pra comparação mês a mês. */
function previousPeriodRange(): { since: string; until: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const until = new Date();
  until.setDate(until.getDate() - 30);
  const since = new Date();
  since.setDate(since.getDate() - 59);
  return { since: fmt(since), until: fmt(until) };
}

async function fetchMeta(
  accessToken: string,
  contaId: string,
  dateRange: string[],
  previousRange: { since: string; until: string }
): Promise<{ current: ChannelAggregate; daily: { date: string; value: number }[]; previous: ChannelAggregate }> {
  const normalizedAccountId = contaId.startsWith('act_') ? contaId : `act_${contaId}`;
  const prevTimeRange = encodeURIComponent(JSON.stringify(previousRange));

  const [currentJson, dailyJson, prevJson] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&date_preset=last_30d&fields=spend,actions`,
      { cache: 'no-store' }
    ).then((r) => r.json()),
    fetch(
      `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&date_preset=last_30d&time_increment=1&fields=spend`,
      { cache: 'no-store' }
    ).then((r) => r.json()),
    fetch(
      `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&time_range=${prevTimeRange}&fields=spend,actions`,
      { cache: 'no-store' }
    ).then((r) => r.json()),
  ]);

  const parseAggregate = (json: { data?: { spend?: string; actions?: { action_type: string; value: string }[] }[] }): ChannelAggregate => {
    const insights = json.data && json.data.length > 0 ? json.data[0] : null;
    let leadsCount = 0;
    if (insights?.actions) {
      const leadAction = (insights.actions as { action_type: string; value: string }[]).find((a) => a.action_type === 'lead');
      if (leadAction) leadsCount = parseInt(leadAction.value);
    }
    const spend = insights ? parseFloat(insights.spend || '0') : 0;
    return { gastos: spend, leads: leadsCount, cpl: leadsCount > 0 ? spend / leadsCount : 0 };
  };

  const dailyRows: { date_start: string; spend?: string }[] = dailyJson.data || [];
  const daily = alignSeries(
    dateRange,
    dailyRows.map((row) => ({ date: row.date_start, value: parseFloat(row.spend || '0') }))
  );

  return { current: parseAggregate(currentJson), daily, previous: parseAggregate(prevJson) };
}

async function fetchGoogle(
  accessToken: string,
  contaId: string,
  developerToken: string,
  dateRange: string[],
  previousRange: { since: string; until: string }
): Promise<{ current: ChannelAggregate; daily: { date: string; value: number }[]; previous: ChannelAggregate }> {
  const customerId = contaId.replace(/-/g, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
  }

  const search = (query: string) =>
    fetch(`https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      cache: 'no-store',
    }).then((r) => r.json());

  const [currentBody, dailyBody, prevBody] = await Promise.all([
    search(`SELECT metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS`),
    search(`SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date DURING LAST_30_DAYS ORDER BY segments.date ASC`),
    search(`SELECT metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${previousRange.since}' AND '${previousRange.until}'`),
  ]);

  const parseAggregate = (body: { results?: { metrics?: { costMicros?: string | number; conversions?: string | number } }[] }): ChannelAggregate => {
    const metrics = body.results?.[0]?.metrics;
    const spend = metrics ? Number(metrics.costMicros || 0) / 1_000_000 : 0;
    const leads = metrics ? Number(metrics.conversions || 0) : 0;
    return { gastos: spend, leads, cpl: leads > 0 ? spend / leads : 0 };
  };

  const dailyRows: { segments?: { date?: string }; metrics?: { costMicros?: string | number } }[] = dailyBody.results || [];
  const daily = alignSeries(
    dateRange,
    dailyRows
      .filter((row) => row.segments?.date)
      .map((row) => ({ date: row.segments!.date!, value: Number(row.metrics?.costMicros || 0) / 1_000_000 }))
  );

  return { current: parseAggregate(currentBody), daily, previous: parseAggregate(prevBody) };
}

/**
 * Busca todos os leads paginando em lotes paralelos (em vez de um por vez em
 * sequência) — contas com milhares de leads levavam dezenas de segundos
 * fazendo uma requisição de cada vez e esperando a resposta antes da próxima.
 */
async function fetchAllKommoLeads(domain: string, accessToken: string): Promise<KommoLead[]> {
  const limit = 250;
  const batchSize = 5;
  const maxPages = 20;
  const allLeads: KommoLead[] = [];
  let page = 1;

  while (page <= maxPages) {
    const pagesInBatch = Array.from({ length: batchSize }, (_, i) => page + i).filter((p) => p <= maxPages);

    const results = await Promise.all(
      pagesInBatch.map(async (p) => {
        const res = await fetch(`https://${domain}/api/v4/leads?limit=${limit}&page=${p}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (res.status === 204) return [] as KommoLead[];
        if (!res.ok) throw new Error(`Erro ao buscar leads do Kommo (${res.status})`);
        const json = await res.json();
        return (json._embedded?.leads || []) as KommoLead[];
      })
    );

    let hitEnd = false;
    for (const leads of results) {
      allLeads.push(...leads);
      if (leads.length < limit) hitEnd = true;
    }

    page += batchSize;
    if (hitEnd) break;
  }

  return allLeads;
}

async function fetchCrm(accessToken: string, contaId: string): Promise<CrmAggregate> {
  const STATUS_GANHO = 142;
  const STATUS_PERDIDO = 143;
  const leads = await fetchAllKommoLeads(contaId, accessToken);

  let oportunidades = 0, ganhas = 0, perdidas = 0, valorGanho = 0;
  for (const lead of leads) {
    oportunidades += 1;
    if (lead.status_id === STATUS_GANHO) {
      ganhas += 1;
      valorGanho += lead.price || 0;
    } else if (lead.status_id === STATUS_PERDIDO) {
      perdidas += 1;
    }
  }

  return { oportunidades, ganhas, perdidas, valorGanho };
}

export default async function ClientOverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  // Fetch client details
  const { data: client, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !client) {
    notFound();
  }

  let fetchError = null;

  // Busca integrações
  const { data: integrations, error: intError } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId);

  if (intError) {
    console.error("Error fetching integrations:", intError);
  }

  const metaInt = integrations?.find(i => i.plataforma === 'meta_ads');
  const googleInt = integrations?.find(i => i.plataforma === 'google_ads');
  const crmInt = integrations?.find(i => i.plataforma === 'crm');

  const dateRange = lastNDates(30);
  const previousRange = previousPeriodRange();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const googleAccessToken = await getValidAgencyGoogleToken(supabase);

  // Meta, Google e CRM são independentes entre si — buscados em paralelo,
  // não um esperando o outro terminar (era o principal motivo da lentidão).
  const [metaResult, googleResult, crmResult] = await Promise.allSettled([
    metaInt?.access_token && metaInt?.conta_id
      ? fetchMeta(metaInt.access_token, metaInt.conta_id, dateRange, previousRange)
      : Promise.reject(new Error('Meta Ads não configurado')),
    googleAccessToken && googleInt?.conta_id && developerToken
      ? fetchGoogle(googleAccessToken, googleInt.conta_id, developerToken, dateRange, previousRange)
      : Promise.reject(new Error('Google Ads não configurado')),
    crmInt?.access_token && crmInt?.conta_id
      ? fetchCrm(crmInt.access_token, crmInt.conta_id)
      : Promise.reject(new Error('CRM não configurado')),
  ]);

  if (metaResult.status === 'rejected') console.error('Error fetching Meta Ads:', metaResult.reason);
  if (googleResult.status === 'rejected') console.error('Error fetching Google Ads:', googleResult.reason);
  if (crmResult.status === 'rejected') console.error('Error fetching Kommo CRM:', crmResult.reason);

  const metaData: ChannelAggregate = metaResult.status === 'fulfilled' ? metaResult.value.current : { gastos: 0, leads: 0, cpl: 0 };
  const metaPrevData: ChannelAggregate = metaResult.status === 'fulfilled' ? metaResult.value.previous : { gastos: 0, leads: 0, cpl: 0 };
  const metaDailySpend = metaResult.status === 'fulfilled' ? metaResult.value.daily : alignSeries(dateRange, []);

  const googleData: ChannelAggregate = googleResult.status === 'fulfilled' ? googleResult.value.current : { gastos: 0, leads: 0, cpl: 0 };
  const googlePrevData: ChannelAggregate = googleResult.status === 'fulfilled' ? googleResult.value.previous : { gastos: 0, leads: 0, cpl: 0 };
  const googleDailySpend = googleResult.status === 'fulfilled' ? googleResult.value.daily : alignSeries(dateRange, []);

  const crmData: CrmAggregate = crmResult.status === 'fulfilled' ? crmResult.value : { oportunidades: 0, ganhas: 0, perdidas: 0, valorGanho: 0 };

  // Aggregate Data
  const totalGastos = metaData.gastos + googleData.gastos;
  const totalLeads = metaData.leads + googleData.leads;
  const cplGeral = totalLeads > 0 ? totalGastos / totalLeads : 0;
  const receitaCRM = crmData.valorGanho;

  // Aggregate Data (período anterior, para comparação)
  const totalGastosPrev = metaPrevData.gastos + googlePrevData.gastos;
  const totalLeadsPrev = metaPrevData.leads + googlePrevData.leads;
  const cplGeralPrev = totalLeadsPrev > 0 ? totalGastosPrev / totalLeadsPrev : 0;
  const hasPreviousData = totalGastosPrev > 0 || totalLeadsPrev > 0;

  const dashboardData = {
    visao_geral: {
      receita: receitaCRM,
      investimento_total: totalGastos,
      leads_totais: totalLeads,
      cpl_geral: cplGeral
    },
    meta_ads: metaData,
    google_ads: googleData,
    crm: crmData
  };

  if (!metaInt?.access_token && !googleAccessToken && !crmInt?.access_token) {
    fetchError = "Nenhuma integração conectada. Vá em Configurações Gerais para vincular Meta Ads, Google Ads e Kommo CRM.";
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <LayoutDashboard className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">{client.nome}</h1>
          <p className="text-zinc-400">Acomp. Mensal</p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
          <div>
            <h3 className="text-red-400 font-bold text-lg mb-1">Erro de Conexão</h3>
            <p className="text-red-200/70">{fetchError}</p>
          </div>
        </div>
      )}

      {dashboardData && dashboardData.visao_geral && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">

          {/* Revenue */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium flex items-center gap-1.5">
                Receita CRM
                <InfoTooltip text="Soma do valor dos negócios ganhos no Kommo no período." />
              </h3>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.receita)}
            </p>
          </div>

          {/* Investment */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium flex items-center gap-1.5">
                Investimento Ads
                <InfoTooltip text="Soma do gasto em Meta Ads e Google Ads no período." />
              </h3>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.investimento_total)}
            </p>
            {hasPreviousData && (
              <ComparisonBadge current={totalGastos} previous={totalGastosPrev} invert />
            )}
          </div>

          {/* Total Leads */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium flex items-center gap-1.5">
                Leads Gerados
                <InfoTooltip text="Total de leads/conversões gerados por Meta Ads e Google Ads somados." />
              </h3>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {dashboardData.visao_geral.leads_totais}
            </p>
            {hasPreviousData && (
              <ComparisonBadge current={totalLeads} previous={totalLeadsPrev} />
            )}
          </div>

          {/* CPL */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium flex items-center gap-1.5">
                Custo por Lead (Geral)
                <InfoTooltip text="Investimento total dividido pelo total de leads gerados nos dois canais." />
              </h3>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.cpl_geral)}
            </p>
            {hasPreviousData && (
              <ComparisonBadge current={cplGeral} previous={cplGeralPrev} invert />
            )}
          </div>

        </div>
      )}

      {/* Investment Trend */}
      {dashboardData && (metaInt?.access_token || googleAccessToken) && (
        <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8 relative z-10 mt-8">
          <h2 className="text-xl font-bold text-white mb-6">Investimento Diário por Canal</h2>
          <TrendChart
            series={[
              { name: 'Meta Ads', color: 'blue', points: metaDailySpend },
              { name: 'Google Ads', color: 'emerald', points: googleDailySpend },
            ]}
            format="currency"
          />
        </div>
      )}

      {/* Breakdown Section */}
      {dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 mt-8">

          {/* Meta vs Google Panel */}
          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Desempenho por Canal</h2>
            <div className="space-y-6">

              <div className="flex items-center justify-between p-4 bg-[#09090b] rounded-2xl border border-[#27272a]">
                <div>
                  <h3 className="text-blue-400 font-bold mb-1">Meta Ads</h3>
                  <p className="text-sm text-zinc-400">{dashboardData.meta_ads.leads} leads gerados</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatCurrency(dashboardData.meta_ads.gastos)}</p>
                  <p className="text-sm text-zinc-400">CPL: {formatCurrency(dashboardData.meta_ads.cpl)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#09090b] rounded-2xl border border-[#27272a]">
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">Google Ads</h3>
                  <p className="text-sm text-zinc-400">{dashboardData.google_ads.leads} leads gerados</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatCurrency(dashboardData.google_ads.gastos)}</p>
                  <p className="text-sm text-zinc-400">CPL: {formatCurrency(dashboardData.google_ads.cpl)}</p>
                </div>
              </div>

            </div>
          </div>

          {/* CRM Funnel */}
          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Funil do CRM</h2>
            <div className="space-y-4">

              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-zinc-400">Total de Oportunidades</span>
                <span className="text-white font-bold text-lg">{dashboardData.crm.oportunidades}</span>
              </div>

              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-emerald-500">Vendas Ganhas</span>
                <span className="text-emerald-400 font-bold text-lg">{dashboardData.crm.ganhas}</span>
              </div>

              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-red-500">Oportunidades Perdidas</span>
                <span className="text-red-400 font-bold text-lg">{dashboardData.crm.perdidas}</span>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
