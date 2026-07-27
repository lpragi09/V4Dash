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
  Percent,
  Video,
  MapPin
} from 'lucide-react';
import Link from 'next/link';
import TrendChart from '@/components/TrendChart';
import InfoTooltip from '@/components/InfoTooltip';
import ComparisonBadge from '@/components/ComparisonBadge';
import DataTable from '@/components/DataTable';
import BrazilMap from '@/components/BrazilMap';
import { getValidAgencyMetaToken } from '@/lib/meta-agency';
import { resolveDateRange, previousDateRange, datesInRange } from '@/lib/date-range';
import { findBrazilStateByName } from '@/lib/brazil-states';
import DateRangeFilter from '@/components/DateRangeFilter';

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

interface MetaActionValue {
  action_type: string;
  value: string;
}

interface MetaCampaignRow {
  id: string;
  nome: string;
  status: string;
  gastos: number;
  leads: number;
  cliques: number;
  ctr: number;
}

interface MetaActionRow {
  tipo: string;
  quantidade: number;
  custo: number;
}

interface MetaDemographicRow {
  faixaEtaria: string;
  genero: string;
  gastos: number;
  leads: number;
}

interface MetaRegionRow {
  regiao: string;
  sigla: string | null;
  gastos: number;
  leads: number;
}

interface MetaPlatformRow {
  plataforma: string;
  gastos: number;
  leads: number;
  impressoes: number;
}

/** Nomes amigáveis pros tipos de ação mais comuns do Meta — o resto mostra o nome técnico mesmo. */
const ACTION_TYPE_LABELS: Record<string, string> = {
  lead: 'Lead',
  onsite_conversion: 'Conversão no site/app',
  onsite_conversion_messaging_conversation_started_7d: 'Conversa iniciada (mensagem)',
  link_click: 'Clique no link',
  landing_page_view: 'Visualização da página',
  post_engagement: 'Engajamento na publicação',
  page_engagement: 'Engajamento na página',
  video_view: 'Visualização de vídeo',
  purchase: 'Compra',
  omni_purchase: 'Compra',
};

function actionLabel(type: string): string {
  return ACTION_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

function findActionValue(actions: MetaActionValue[] | undefined, type: string): number {
  const found = actions?.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
}

async function fetchMetaJson(url: string): Promise<{ data?: unknown[]; error?: { message?: string } }> {
  const res = await fetch(url, { cache: 'no-store' });
  return res.json();
}

async function fetchMetaCampaigns(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaCampaignRow[]> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const fields = 'campaign_id,campaign_name,spend,clicks,ctr,actions';
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&level=campaign&time_range=${timeRange}&fields=${fields}&limit=200`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const rows = (json.data || []) as {
    campaign_id: string;
    campaign_name: string;
    spend?: string;
    clicks?: string;
    ctr?: string;
    actions?: MetaActionValue[];
  }[];

  // Status não vem no insights — busca à parte e casa pelo ID.
  const statusUrl = `https://graph.facebook.com/v19.0/${accountId}/campaigns?access_token=${accessToken}&fields=id,status&limit=200`;
  const statusJson = await fetchMetaJson(statusUrl).catch(() => ({ data: [] }));
  const statusMap = new Map(((statusJson.data || []) as { id: string; status: string }[]).map((c) => [c.id, c.status]));

  return rows
    .map((row) => ({
      id: row.campaign_id,
      nome: row.campaign_name,
      status: statusMap.get(row.campaign_id) || '—',
      gastos: parseFloat(row.spend || '0'),
      leads: findActionValue(row.actions, 'lead'),
      cliques: parseInt(row.clicks || '0', 10),
      ctr: parseFloat(row.ctr || '0'),
    }))
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => b.gastos - a.gastos);
}

async function fetchMetaActionBreakdown(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaActionRow[]> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&fields=actions,cost_per_action_type`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const insight = (json.data?.[0] || {}) as { actions?: MetaActionValue[]; cost_per_action_type?: MetaActionValue[] };
  const actions = insight.actions || [];
  const costs = insight.cost_per_action_type || [];

  return actions
    .map((a) => ({
      tipo: actionLabel(a.action_type),
      quantidade: parseFloat(a.value),
      custo: findActionValue(costs, a.action_type),
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

async function fetchMetaVideoAndRoas(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<{ videoPlays: number; videoAvgWatchSec: number; valorConversao: number }> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const fields = 'video_play_actions,video_avg_time_watched_actions,action_values';
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&fields=${fields}`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const insight = (json.data?.[0] || {}) as {
    video_play_actions?: MetaActionValue[];
    video_avg_time_watched_actions?: MetaActionValue[];
    action_values?: MetaActionValue[];
  };

  const videoPlays = findActionValue(insight.video_play_actions, 'video_view');
  const videoAvgWatchSec = findActionValue(insight.video_avg_time_watched_actions, 'video_view');
  const valorConversao =
    findActionValue(insight.action_values, 'omni_purchase') || findActionValue(insight.action_values, 'purchase');

  return { videoPlays, videoAvgWatchSec, valorConversao };
}

async function fetchMetaDemographics(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaDemographicRow[]> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&breakdowns=age,gender&fields=spend,actions&limit=200`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const rows = (json.data || []) as { age?: string; gender?: string; spend?: string; actions?: MetaActionValue[] }[];
  return rows
    // Idade/gênero "unknown" e valores residuais de poucos centavos são ruído
    // de atribuição do Meta, não público real segmentável — fora da tabela.
    .filter((row) => row.age && row.age !== 'unknown' && row.gender && row.gender !== 'unknown')
    .map((row) => ({
      faixaEtaria: row.age!,
      genero: row.gender === 'male' ? 'Masculino' : 'Feminino',
      gastos: parseFloat(row.spend || '0'),
      leads: findActionValue(row.actions, 'lead'),
    }))
    .filter((row) => row.gastos >= 1)
    .sort((a, b) => {
      const ageA = parseInt(a.faixaEtaria, 10);
      const ageB = parseInt(b.faixaEtaria, 10);
      if (ageA !== ageB) return ageA - ageB;
      return a.genero.localeCompare(b.genero);
    });
}

async function fetchMetaPlatforms(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaPlatformRow[]> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&breakdowns=publisher_platform&fields=spend,impressions,actions&limit=200`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const rows = (json.data || []) as { publisher_platform?: string; spend?: string; impressions?: string; actions?: MetaActionValue[] }[];
  const labels: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger' };
  return rows
    .map((row) => ({
      plataforma: labels[row.publisher_platform || ''] || row.publisher_platform || '—',
      gastos: parseFloat(row.spend || '0'),
      leads: findActionValue(row.actions, 'lead'),
      impressoes: parseInt(row.impressions || '0', 10),
    }))
    .sort((a, b) => b.gastos - a.gastos);
}

async function fetchMetaRegions(
  accountId: string,
  accessToken: string,
  range: { since: string; until: string }
): Promise<MetaRegionRow[]> {
  const timeRange = encodeURIComponent(JSON.stringify(range));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?access_token=${accessToken}&time_range=${timeRange}&breakdowns=region&fields=spend,actions&limit=200`;
  const json = await fetchMetaJson(url);
  if (json.error) throw new Error(json.error.message);

  const rows = (json.data || []) as { region?: string; spend?: string; actions?: MetaActionValue[] }[];
  const bySigla = new Map<string, MetaRegionRow>();

  for (const row of rows) {
    // "Unknown" é ruído de atribuição do Meta (não dá pra localizar o estado), sem valor pro relatório.
    if (!row.region || row.region.toLowerCase() === 'unknown') continue;
    const gastos = parseFloat(row.spend || '0');
    const leads = findActionValue(row.actions, 'lead');
    const match = findBrazilStateByName(row.region);
    const key = match?.sigla || row.region;
    const existing = bySigla.get(key);
    if (existing) {
      existing.gastos += gastos;
      existing.leads += leads;
    } else {
      bySigla.set(key, { regiao: match?.name || row.region, sigla: match?.sigla || null, gastos, leads });
    }
  }

  return Array.from(bySigla.values()).sort((a, b) => b.gastos - a.gastos);
}

/** Preenche com 0 os dias sem retorno da API, pra série sempre ir até hoje. */
function alignSeries(dates: string[], rows: { date: string; value: number }[]): { date: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.date, r.value]));
  return dates.map((d) => ({ date: d, value: map.get(d) || 0 }));
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

export default async function MetaAdsClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { clientId } = await params;
  const resolvedSearchParams = await searchParams;
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
  let campaigns: MetaCampaignRow[] = [];
  let actionBreakdown: MetaActionRow[] = [];
  let demographics: MetaDemographicRow[] = [];
  let platforms: MetaPlatformRow[] = [];
  let regions: MetaRegionRow[] = [];
  let videoPlays = 0;
  let videoAvgWatchSec = 0;
  let valorConversao = 0;

  if (!accessToken) {
    fetchError = "Meta Ads não autorizado pela agência. Autorize em Configurações Gerais.";
  } else if (!metaAccountId) {
    fetchError = "Nenhuma conta de anúncios foi selecionada para este cliente. Escolha uma conta em Configurações Gerais.";
  } else {
    try {
      const normalizedAccountId = metaAccountId.startsWith('act_') ? metaAccountId : `act_${metaAccountId}`;
      const current = resolveDateRange(resolvedSearchParams, 30);
      const previous = previousDateRange(current);
      const currentTimeRange = encodeURIComponent(JSON.stringify(current));
      const dailyUrl = `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${accessToken}&time_range=${currentTimeRange}&time_increment=1&fields=spend,actions`;

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
        const dateRange = datesInRange(current);
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

      // Detalhamentos extras (campanha, tipo de ação, público, plataforma, vídeo/ROAS)
      // são independentes do card principal — se um falhar, os outros continuam
      // aparecendo normalmente, só essa seção específica some.
      const [campaignsSettled, actionsSettled, demoSettled, platformsSettled, regionsSettled, videoRoasSettled] = await Promise.allSettled([
        fetchMetaCampaigns(normalizedAccountId, accessToken, current),
        fetchMetaActionBreakdown(normalizedAccountId, accessToken, current),
        fetchMetaDemographics(normalizedAccountId, accessToken, current),
        fetchMetaPlatforms(normalizedAccountId, accessToken, current),
        fetchMetaRegions(normalizedAccountId, accessToken, current),
        fetchMetaVideoAndRoas(normalizedAccountId, accessToken, current),
      ]);

      if (campaignsSettled.status === 'fulfilled') campaigns = campaignsSettled.value;
      else console.error('Error fetching Meta campaigns breakdown:', campaignsSettled.reason);

      if (actionsSettled.status === 'fulfilled') actionBreakdown = actionsSettled.value;
      else console.error('Error fetching Meta action breakdown:', actionsSettled.reason);

      if (demoSettled.status === 'fulfilled') demographics = demoSettled.value;
      else console.error('Error fetching Meta demographics:', demoSettled.reason);

      if (platformsSettled.status === 'fulfilled') platforms = platformsSettled.value;
      else console.error('Error fetching Meta platforms:', platformsSettled.reason);

      if (regionsSettled.status === 'fulfilled') regions = regionsSettled.value;
      else console.error('Error fetching Meta regions:', regionsSettled.reason);

      if (videoRoasSettled.status === 'fulfilled') {
        videoPlays = videoRoasSettled.value.videoPlays;
        videoAvgWatchSec = videoRoasSettled.value.videoAvgWatchSec;
        valorConversao = videoRoasSettled.value.valorConversao;
      } else {
        console.error('Error fetching Meta video/ROAS:', videoRoasSettled.reason);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Activity className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração Meta Ads</h1>
            <p className="text-zinc-400">Desempenho de campanhas de {client.nome}</p>
          </div>
        </div>
        <DateRangeFilter />
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
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

          {(videoPlays > 0 || valorConversao > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {videoPlays > 0 && (
                <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
                  <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      Reproduções de Vídeo
                      <InfoTooltip text="Número de vezes que os vídeos dos anúncios foram reproduzidos." />
                    </span>
                    <Video className="w-5 h-5 text-zinc-500" />
                  </h3>
                  <p className="text-3xl font-bold text-white mb-2">{videoPlays}</p>
                </div>
              )}
              {videoAvgWatchSec > 0 && (
                <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
                  <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      Tempo Médio Assistido
                      <InfoTooltip text="Média de segundos que as pessoas assistiram aos vídeos dos anúncios." />
                    </span>
                    <Video className="w-5 h-5 text-zinc-500" />
                  </h3>
                  <p className="text-3xl font-bold text-white mb-2">{videoAvgWatchSec.toFixed(1)}s</p>
                </div>
              )}
              {valorConversao > 0 && (
                <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
                  <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      Valor de Conversão
                      <InfoTooltip text="Valor monetário total atribuído às compras/conversões rastreadas pelo pixel do Meta no período." />
                    </span>
                    <DollarSign className="w-5 h-5 text-zinc-500" />
                  </h3>
                  <p className="text-3xl font-bold text-white mb-2">{formatCurrency(valorConversao)}</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              Desempenho por Campanha
              <InfoTooltip text="Cada campanha listada separadamente, sem somar com as demais." />
            </h2>
            <DataTable
              getRowKey={(row: MetaCampaignRow) => row.id}
              rows={campaigns}
              columns={[
                { key: 'nome', label: 'Campanha', render: (r) => <span className="text-white">{r.nome}</span> },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/50 text-zinc-400'
                      }`}
                    >
                      {r.status === 'ACTIVE' ? 'Ativa' : r.status === 'PAUSED' ? 'Pausada' : r.status}
                    </span>
                  ),
                },
                { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                { key: 'leads', label: 'Leads', align: 'right', render: (r) => r.leads },
                {
                  key: 'cpl',
                  label: 'CPL',
                  align: 'right',
                  render: (r) => formatCurrency(r.leads > 0 ? r.gastos / r.leads : 0),
                },
                { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                { key: 'ctr', label: 'CTR', align: 'right', render: (r) => `${r.ctr.toFixed(2)}%` },
              ]}
            />
          </div>

          {actionBreakdown.length > 0 && (
            <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                Detalhamento por Tipo de Ação
                <InfoTooltip text="Todas as ações rastreadas pelo Meta no período, cada tipo separado (não é só 'lead')." />
              </h2>
              <DataTable
                getRowKey={(row: MetaActionRow) => row.tipo}
                rows={actionBreakdown}
                columns={[
                  { key: 'tipo', label: 'Tipo de Ação', render: (r) => <span className="text-white capitalize">{r.tipo}</span> },
                  { key: 'quantidade', label: 'Quantidade', align: 'right', render: (r) => r.quantidade },
                  { key: 'custo', label: 'Custo por Ação', align: 'right', render: (r) => formatCurrency(r.custo) },
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {demographics.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  Público (Idade e Gênero)
                  <InfoTooltip text="Gasto e leads segmentados por faixa etária e gênero." />
                </h2>
                <DataTable
                  getRowKey={(row: MetaDemographicRow, i) => `${row.faixaEtaria}-${row.genero}-${i}`}
                  rows={demographics}
                  columns={[
                    { key: 'faixaEtaria', label: 'Faixa Etária', render: (r) => <span className="text-white">{r.faixaEtaria}</span> },
                    { key: 'genero', label: 'Gênero', render: (r) => r.genero },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                    { key: 'leads', label: 'Leads', align: 'right', render: (r) => r.leads },
                  ]}
                />
              </div>
            )}

            {platforms.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  Plataforma
                  <InfoTooltip text="Gasto, leads e impressões separados por onde o anúncio apareceu (Facebook, Instagram, etc)." />
                </h2>
                <DataTable
                  getRowKey={(row: MetaPlatformRow) => row.plataforma}
                  rows={platforms}
                  columns={[
                    { key: 'plataforma', label: 'Plataforma', render: (r) => <span className="text-white">{r.plataforma}</span> },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                    { key: 'leads', label: 'Leads', align: 'right', render: (r) => r.leads },
                    { key: 'impressoes', label: 'Impressões', align: 'right', render: (r) => r.impressoes },
                  ]}
                />
              </div>
            )}
          </div>

          {regions.length > 0 && (
            <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                Alcance por Região
                <InfoTooltip text="Gasto e leads por estado do Brasil, com base em onde as pessoas alcançadas pelos anúncios estão. Estados sem cor não tiveram gasto registrado no período." />
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <BrazilMap
                  data={Object.fromEntries(regions.filter((r) => r.sigla).map((r) => [r.sigla as string, r.gastos]))}
                  format="currency"
                  accentColor="#3b82f6"
                />
                <DataTable
                  getRowKey={(row: MetaRegionRow, i) => `${row.regiao}-${i}`}
                  rows={regions.slice(0, 15)}
                  columns={[
                    { key: 'regiao', label: 'Estado', render: (r) => <span className="text-white">{r.regiao}</span> },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                    { key: 'leads', label: 'Leads', align: 'right', render: (r) => r.leads },
                  ]}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
