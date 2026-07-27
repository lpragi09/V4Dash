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
  Percent,
  Smartphone,
  Target,
  MapPin
} from 'lucide-react';
import Link from 'next/link';
import TrendChart from '@/components/TrendChart';
import InfoTooltip from '@/components/InfoTooltip';
import ComparisonBadge from '@/components/ComparisonBadge';
import DataTable from '@/components/DataTable';
import BrazilMap from '@/components/BrazilMap';
import { getValidAgencyGoogleToken } from '@/lib/google-agency';
import { resolveDateRange, previousDateRange, datesInRange } from '@/lib/date-range';
import { findBrazilStateByName } from '@/lib/brazil-states';
import DateRangeFilter from '@/components/DateRangeFilter';

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
  valorConversao: number;
  impressionShare: number;
}

interface GoogleCampaignRow {
  id: string;
  nome: string;
  status: string;
  gastos: number;
  leads: number;
  cliques: number;
  ctr: number;
}

interface GoogleSearchTermRow {
  termo: string;
  cliques: number;
  impressoes: number;
  gastos: number;
  conversoes: number;
}

interface GoogleKeywordRow {
  palavra: string;
  matchType: string;
  qualityScore: number | null;
  cliques: number;
  gastos: number;
  conversoes: number;
}

interface GoogleDeviceRow {
  dispositivo: string;
  gastos: number;
  cliques: number;
  conversoes: number;
}

interface GoogleAgeRow {
  faixaEtaria: string;
  gastos: number;
  cliques: number;
  conversoes: number;
}

interface GoogleGenderRow {
  genero: string;
  gastos: number;
  cliques: number;
  conversoes: number;
}

interface GoogleGeography {
  regions: Record<string, number>;
  citiesByState: Record<string, { nome: string; valor: number }[]>;
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: 'Exata',
  PHRASE: 'Frase',
  BROAD: 'Ampla',
};

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: 'Celular',
  DESKTOP: 'Computador',
  TABLET: 'Tablet',
  CONNECTED_TV: 'TV Conectada',
  OTHER: 'Outro',
};

const AGE_RANGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: '18-24',
  AGE_RANGE_25_34: '25-34',
  AGE_RANGE_35_44: '35-44',
  AGE_RANGE_45_54: '45-54',
  AGE_RANGE_55_64: '55-64',
  AGE_RANGE_65_UP: '65+',
};

const GENDER_LABELS: Record<string, string> = {
  GENDER_MALE: 'Masculino',
  GENDER_FEMALE: 'Feminino',
};

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  ENABLED: 'Ativa',
  PAUSED: 'Pausada',
  REMOVED: 'Removida',
};

/** Preenche com 0 os dias sem retorno da API, pra série sempre ir até hoje. */
function alignSeries(dates: string[], rows: { date: string; value: number }[]): { date: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.date, r.value]));
  return dates.map((d) => ({ date: d, value: map.get(d) || 0 }));
}

async function googleSearch(customerId: string, headers: Record<string, string>, query: string) {
  const res = await fetch(`https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `Erro na API do Google Ads (${res.status})`);
  }
  return body;
}

async function fetchGoogleAggregate(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleAggregate> {
  const query = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.search_impression_share FROM customer WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
  const body = await googleSearch(customerId, headers, query);

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
    valorConversao: metrics ? Number(metrics.conversionsValue || 0) : 0,
    impressionShare: metrics ? Number(metrics.searchImpressionShare || 0) * 100 : 0,
  };
}

async function fetchGoogleCampaigns(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleCampaignRow[]> {
  const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.ctr FROM campaign WHERE segments.date BETWEEN '${range.since}' AND '${range.until}' AND campaign.status = 'ENABLED' ORDER BY metrics.cost_micros DESC`;
  const body = await googleSearch(customerId, headers, query);
  const rows: { campaign?: { id?: string; name?: string; status?: string }; metrics?: Record<string, unknown> }[] = body.results || [];

  return rows.map((row) => ({
    id: row.campaign?.id || '',
    nome: row.campaign?.name || '—',
    status: CAMPAIGN_STATUS_LABELS[row.campaign?.status || ''] || row.campaign?.status || '—',
    gastos: Number(row.metrics?.costMicros || 0) / 1_000_000,
    leads: Number(row.metrics?.conversions || 0),
    cliques: Number(row.metrics?.clicks || 0),
    ctr: Number(row.metrics?.ctr || 0) * 100,
  }));
}

async function fetchGoogleSearchTerms(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleSearchTermRow[]> {
  const query = `SELECT search_term_view.search_term, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}' ORDER BY metrics.clicks DESC LIMIT 20`;
  const body = await googleSearch(customerId, headers, query);
  const rows: { searchTermView?: { searchTerm?: string }; metrics?: Record<string, unknown> }[] = body.results || [];

  return rows.map((row) => ({
    termo: row.searchTermView?.searchTerm || '—',
    cliques: Number(row.metrics?.clicks || 0),
    impressoes: Number(row.metrics?.impressions || 0),
    gastos: Number(row.metrics?.costMicros || 0) / 1_000_000,
    conversoes: Number(row.metrics?.conversions || 0),
  }));
}

async function fetchGoogleKeywords(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleKeywordRow[]> {
  const query = `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}' ORDER BY metrics.clicks DESC LIMIT 20`;
  const body = await googleSearch(customerId, headers, query);
  const rows: {
    adGroupCriterion?: { keyword?: { text?: string; matchType?: string }; qualityInfo?: { qualityScore?: number } };
    metrics?: Record<string, unknown>;
  }[] = body.results || [];

  return rows.map((row) => ({
    palavra: row.adGroupCriterion?.keyword?.text || '—',
    matchType: MATCH_TYPE_LABELS[row.adGroupCriterion?.keyword?.matchType || ''] || row.adGroupCriterion?.keyword?.matchType || '—',
    qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
    cliques: Number(row.metrics?.clicks || 0),
    gastos: Number(row.metrics?.costMicros || 0) / 1_000_000,
    conversoes: Number(row.metrics?.conversions || 0),
  }));
}

async function fetchGoogleDevices(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleDeviceRow[]> {
  const query = `SELECT segments.device, metrics.cost_micros, metrics.clicks, metrics.conversions FROM customer WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
  const body = await googleSearch(customerId, headers, query);
  const rows: { segments?: { device?: string }; metrics?: Record<string, unknown> }[] = body.results || [];

  return rows
    .map((row) => ({
      dispositivo: DEVICE_LABELS[row.segments?.device || ''] || row.segments?.device || '—',
      gastos: Number(row.metrics?.costMicros || 0) / 1_000_000,
      cliques: Number(row.metrics?.clicks || 0),
      conversoes: Number(row.metrics?.conversions || 0),
    }))
    .sort((a, b) => b.gastos - a.gastos);
}

async function fetchGoogleAgeRanges(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleAgeRow[]> {
  const query = `SELECT ad_group_criterion.age_range.type, metrics.cost_micros, metrics.clicks, metrics.conversions FROM age_range_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
  const body = await googleSearch(customerId, headers, query);
  const rows: { adGroupCriterion?: { ageRange?: { type?: string } }; metrics?: Record<string, unknown> }[] = body.results || [];

  const byType = new Map<string, GoogleAgeRow>();
  for (const row of rows) {
    const type = row.adGroupCriterion?.ageRange?.type || '';
    const label = AGE_RANGE_LABELS[type];
    if (!label) continue; // ignora UNDETERMINED e valores desconhecidos, é ruído sem valor no relatório
    const entry = byType.get(label) || { faixaEtaria: label, gastos: 0, cliques: 0, conversoes: 0 };
    entry.gastos += Number(row.metrics?.costMicros || 0) / 1_000_000;
    entry.cliques += Number(row.metrics?.clicks || 0);
    entry.conversoes += Number(row.metrics?.conversions || 0);
    byType.set(label, entry);
  }

  return Array.from(byType.values()).sort((a, b) => parseInt(a.faixaEtaria, 10) - parseInt(b.faixaEtaria, 10));
}

async function fetchGoogleGenders(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleGenderRow[]> {
  const query = `SELECT ad_group_criterion.gender.type, metrics.cost_micros, metrics.clicks, metrics.conversions FROM gender_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
  const body = await googleSearch(customerId, headers, query);
  const rows: { adGroupCriterion?: { gender?: { type?: string } }; metrics?: Record<string, unknown> }[] = body.results || [];

  const byType = new Map<string, GoogleGenderRow>();
  for (const row of rows) {
    const type = row.adGroupCriterion?.gender?.type || '';
    const label = GENDER_LABELS[type];
    if (!label) continue; // ignora UNDETERMINED
    const entry = byType.get(label) || { genero: label, gastos: 0, cliques: 0, conversoes: 0 };
    entry.gastos += Number(row.metrics?.costMicros || 0) / 1_000_000;
    entry.cliques += Number(row.metrics?.clicks || 0);
    entry.conversoes += Number(row.metrics?.conversions || 0);
    byType.set(label, entry);
  }

  return Array.from(byType.values()).sort((a, b) => b.gastos - a.gastos);
}

function extractGeoId(resourceName?: string): string | null {
  if (!resourceName) return null;
  const id = resourceName.split('/').pop();
  return id || null;
}

/**
 * Busca gasto por estado e por cidade dentro de cada estado (geographic_view),
 * e resolve os IDs de geo_target_constant pros nomes de verdade numa segunda
 * consulta — a primeira só retorna o resource name (ex: geoTargetConstants/20135).
 */
async function fetchGoogleGeography(
  customerId: string,
  headers: Record<string, string>,
  range: { since: string; until: string }
): Promise<GoogleGeography> {
  const query = `SELECT segments.geo_target_state, segments.geo_target_city, metrics.cost_micros, metrics.clicks, metrics.conversions FROM geographic_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
  const body = await googleSearch(customerId, headers, query);
  const rows: {
    segments?: { geoTargetState?: string; geoTargetCity?: string };
    metrics?: Record<string, unknown>;
  }[] = body.results || [];

  const stateIds = new Set<string>();
  const cityIds = new Set<string>();
  for (const row of rows) {
    const stateId = extractGeoId(row.segments?.geoTargetState);
    const cityId = extractGeoId(row.segments?.geoTargetCity);
    if (stateId) stateIds.add(stateId);
    if (cityId) cityIds.add(cityId);
  }

  const allIds = [...stateIds, ...cityIds];
  const nameById = new Map<string, string>();
  if (allIds.length > 0) {
    const idsQuery = `SELECT geo_target_constant.id, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.id IN (${allIds.join(',')})`;
    const idsBody = await googleSearch(customerId, headers, idsQuery);
    const idRows: { geoTargetConstant?: { id?: string; name?: string } }[] = idsBody.results || [];
    for (const row of idRows) {
      if (row.geoTargetConstant?.id && row.geoTargetConstant?.name) {
        nameById.set(String(row.geoTargetConstant.id), row.geoTargetConstant.name);
      }
    }
  }

  const regions: Record<string, number> = {};
  const cityValuesByState = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const gastos = Number(row.metrics?.costMicros || 0) / 1_000_000;
    const stateId = extractGeoId(row.segments?.geoTargetState);
    const stateName = stateId ? nameById.get(stateId) : null;
    const match = stateName ? findBrazilStateByName(stateName) : undefined;

    if (match) {
      regions[match.sigla] = (regions[match.sigla] || 0) + gastos;

      const cityId = extractGeoId(row.segments?.geoTargetCity);
      const cityName = cityId ? nameById.get(cityId) : null;
      if (cityName) {
        const stateCities = cityValuesByState.get(match.sigla) || new Map<string, number>();
        stateCities.set(cityName, (stateCities.get(cityName) || 0) + gastos);
        cityValuesByState.set(match.sigla, stateCities);
      }
    }
  }

  const citiesByState: Record<string, { nome: string; valor: number }[]> = {};
  for (const [sigla, cityMap] of cityValuesByState) {
    citiesByState[sigla] = Array.from(cityMap.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }

  return { regions, citiesByState };
}

export default async function GoogleAdsClientPage({
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
  let campaigns: GoogleCampaignRow[] = [];
  let searchTerms: GoogleSearchTermRow[] = [];
  let keywords: GoogleKeywordRow[] = [];
  let devices: GoogleDeviceRow[] = [];
  let ageRanges: GoogleAgeRow[] = [];
  let genders: GoogleGenderRow[] = [];
  let geography: GoogleGeography = { regions: {}, citiesByState: {} };

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

      const current = resolveDateRange(resolvedSearchParams, 30);
      const previous = previousDateRange(current);
      const dailyQuery = `SELECT segments.date, metrics.clicks, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${current.since}' AND '${current.until}' ORDER BY segments.date ASC`;

      // Período atual, período anterior e série diária são independentes —
      // buscados em paralelo em vez de um esperar o outro terminar.
      const [currentSettled, previousSettled, dailySettled] = await Promise.allSettled([
        fetchGoogleAggregate(customerId, headers, current),
        fetchGoogleAggregate(customerId, headers, previous),
        fetch(`https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:search`, {
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
        const dateRange = datesInRange(current);
        const validRows = dailyRows.filter((row) => row.segments?.date);
        dailySpend = alignSeries(
          dateRange,
          validRows.map((row) => ({ date: row.segments!.date!, value: Number(row.metrics?.costMicros || 0) / 1_000_000 }))
        );
        dailyClicks = alignSeries(
          dateRange,
          validRows.map((row) => ({ date: row.segments!.date!, value: Number(row.metrics?.clicks || 0) }))
        );
      } else {
        console.error('Error fetching daily Google Ads series:', dailySettled.reason);
      }

      // Detalhamentos extras (campanha, termos de pesquisa, palavras-chave,
      // dispositivo) são independentes do card principal — se um falhar, só
      // essa seção específica some, o resto da página continua normal.
      const [campaignsSettled, searchTermsSettled, keywordsSettled, devicesSettled, ageSettled, genderSettled, geographySettled] = await Promise.allSettled([
        fetchGoogleCampaigns(customerId, headers, current),
        fetchGoogleSearchTerms(customerId, headers, current),
        fetchGoogleKeywords(customerId, headers, current),
        fetchGoogleDevices(customerId, headers, current),
        fetchGoogleAgeRanges(customerId, headers, current),
        fetchGoogleGenders(customerId, headers, current),
        fetchGoogleGeography(customerId, headers, current),
      ]);

      if (campaignsSettled.status === 'fulfilled') campaigns = campaignsSettled.value;
      else console.error('Error fetching Google campaigns breakdown:', campaignsSettled.reason);

      if (searchTermsSettled.status === 'fulfilled') searchTerms = searchTermsSettled.value;
      else console.error('Error fetching Google search terms:', searchTermsSettled.reason);

      if (keywordsSettled.status === 'fulfilled') keywords = keywordsSettled.value;
      else console.error('Error fetching Google keywords:', keywordsSettled.reason);

      if (devicesSettled.status === 'fulfilled') devices = devicesSettled.value;
      else console.error('Error fetching Google devices breakdown:', devicesSettled.reason);

      if (ageSettled.status === 'fulfilled') ageRanges = ageSettled.value;
      else console.error('Error fetching Google age ranges:', ageSettled.reason);

      if (genderSettled.status === 'fulfilled') genders = genderSettled.value;
      else console.error('Error fetching Google genders:', genderSettled.reason);

      if (geographySettled.status === 'fulfilled') geography = geographySettled.value;
      else console.error('Error fetching Google geography:', geographySettled.reason);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Search className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração Google Ads</h1>
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="inline">
                  Gastos (Google)
                  <InfoTooltip text="Valor total investido em campanhas do Google Ads no período." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.gastos)}</p>
              {previousData && <ComparisonBadge current={dashboardData.gastos} previous={previousData.gastos} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="inline">
                  Leads (Google)
                  <InfoTooltip text="Número de conversões registradas nas campanhas do Google Ads." />
                </span>
                <Users className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.leads}</p>
              {previousData && <ComparisonBadge current={dashboardData.leads} previous={previousData.leads} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="inline">
                  Custo por Lead
                  <InfoTooltip text="Gasto total dividido pelo número de conversões geradas (CPL)." />
                </span>
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpl)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpl} previous={previousData.cpl} invert />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="inline">
                  Cliques
                  <InfoTooltip text="Quantidade de cliques nos anúncios do Google Ads." />
                </span>
                <Activity className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{dashboardData.cliques}</p>
              {previousData && <ComparisonBadge current={dashboardData.cliques} previous={previousData.cliques} />}
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="inline">
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
                <span className="inline">
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
                <span className="inline">
                  CPC Médio
                  <InfoTooltip text="Valor médio pago por clique." />
                </span>
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.cpcMedio)}</p>
              {previousData && <ComparisonBadge current={dashboardData.cpcMedio} previous={previousData.cpcMedio} invert />}
            </div>

            {dashboardData.valorConversao > 0 && (
              <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
                <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                  <span className="inline">
                    Valor de Conversão
                    <InfoTooltip text="Valor monetário total atribuído às conversões rastreadas no Google Ads no período." />
                  </span>
                  <DollarSign className="w-5 h-5 text-zinc-500" />
                </h3>
                <p className="text-3xl font-bold text-white mb-2">{formatCurrency(dashboardData.valorConversao)}</p>
                {previousData && <ComparisonBadge current={dashboardData.valorConversao} previous={previousData.valorConversao} />}
              </div>
            )}

            {dashboardData.impressionShare > 0 && (
              <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
                <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                  <span className="inline">
                    Impression Share (Pesquisa)
                    <InfoTooltip text="Percentual de impressões que suas campanhas de pesquisa receberam em relação ao total que poderiam ter recebido." />
                  </span>
                  <Target className="w-5 h-5 text-zinc-500" />
                </h3>
                <p className="text-3xl font-bold text-white mb-2">{dashboardData.impressionShare.toFixed(1)}%</p>
                {previousData && <ComparisonBadge current={dashboardData.impressionShare} previous={previousData.impressionShare} />}
              </div>
            )}
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

          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              Desempenho por Campanha
              <InfoTooltip text="Cada campanha listada separadamente, sem somar com as demais." />
            </h2>
            <DataTable
              getRowKey={(row: GoogleCampaignRow) => row.id}
              rows={campaigns}
              columns={[
                { key: 'nome', label: 'Campanha', render: (r) => <span className="text-white">{r.nome}</span> },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                      {r.status}
                    </span>
                  ),
                },
                { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                { key: 'leads', label: 'Leads', align: 'right', render: (r) => r.leads },
                { key: 'cpl', label: 'CPL', align: 'right', render: (r) => formatCurrency(r.leads > 0 ? r.gastos / r.leads : 0) },
                { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                { key: 'ctr', label: 'CTR', align: 'right', render: (r) => `${r.ctr.toFixed(2)}%` },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {searchTerms.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  Termos de Pesquisa
                  <InfoTooltip text="O que as pessoas digitaram no Google antes de ver o anúncio — top 20 por cliques." />
                </h2>
                <DataTable
                  getRowKey={(row: GoogleSearchTermRow, i) => `${row.termo}-${i}`}
                  rows={searchTerms}
                  columns={[
                    { key: 'termo', label: 'Termo', render: (r) => <span className="text-white">{r.termo}</span> },
                    { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                    { key: 'conversoes', label: 'Conversões', align: 'right', render: (r) => r.conversoes },
                  ]}
                />
              </div>
            )}

            {keywords.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  Palavras-chave
                  <InfoTooltip text="Desempenho por palavra-chave, com o Quality Score do Google (1 a 10) quando disponível — top 20 por cliques." />
                </h2>
                <DataTable
                  getRowKey={(row: GoogleKeywordRow, i) => `${row.palavra}-${i}`}
                  rows={keywords}
                  columns={[
                    { key: 'palavra', label: 'Palavra-chave', render: (r) => <span className="text-white">{r.palavra}</span> },
                    { key: 'matchType', label: 'Correspondência', render: (r) => r.matchType },
                    { key: 'qualityScore', label: 'Quality Score', align: 'right', render: (r) => r.qualityScore ?? '—' },
                    { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                  ]}
                />
              </div>
            )}
          </div>

          {(devices.length > 0 || ageRanges.length > 0 || genders.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {devices.length > 0 && (
                <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-zinc-500" />
                    Por Dispositivo
                    <InfoTooltip text="Gasto, cliques e conversões separados por celular, computador e tablet." />
                  </h2>
                  <DataTable
                    getRowKey={(row: GoogleDeviceRow) => row.dispositivo}
                    rows={devices}
                    columns={[
                      { key: 'dispositivo', label: 'Dispositivo', render: (r) => <span className="text-white">{r.dispositivo}</span> },
                      { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                      { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                      { key: 'conversoes', label: 'Conversões', align: 'right', render: (r) => r.conversoes },
                    ]}
                  />
                </div>
              )}

              {ageRanges.length > 0 && (
                <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    Público por Idade
                    <InfoTooltip text="Gasto, cliques e conversões por faixa etária, ordenado da mais nova pra mais velha." />
                  </h2>
                  <DataTable
                    getRowKey={(row: GoogleAgeRow) => row.faixaEtaria}
                    rows={ageRanges}
                    columns={[
                      { key: 'faixaEtaria', label: 'Faixa Etária', render: (r) => <span className="text-white">{r.faixaEtaria}</span> },
                      { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                      { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                      { key: 'conversoes', label: 'Conversões', align: 'right', render: (r) => r.conversoes },
                    ]}
                  />
                </div>
              )}

              {genders.length > 0 && (
                <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    Público por Gênero
                    <InfoTooltip text="Gasto, cliques e conversões por gênero." />
                  </h2>
                  <DataTable
                    getRowKey={(row: GoogleGenderRow) => row.genero}
                    rows={genders}
                    columns={[
                      { key: 'genero', label: 'Gênero', render: (r) => <span className="text-white">{r.genero}</span> },
                      { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
                      { key: 'cliques', label: 'Cliques', align: 'right', render: (r) => r.cliques },
                      { key: 'conversoes', label: 'Conversões', align: 'right', render: (r) => r.conversoes },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {Object.keys(geography.regions).length > 0 && (
            <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-500" />
                Alcance por Região
                <InfoTooltip text="Gasto por estado do Brasil. Passe o mouse sobre um estado pra ver as principais cidades dentro dele." />
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <BrazilMap data={geography.regions} format="currency" accentColor="#10b981" citiesByState={geography.citiesByState} />
                <DataTable
                  getRowKey={(row: { sigla: string; gastos: number }) => row.sigla}
                  rows={Object.entries(geography.regions)
                    .map(([sigla, gastos]) => ({ sigla, gastos }))
                    .sort((a, b) => b.gastos - a.gastos)
                    .slice(0, 15)}
                  columns={[
                    { key: 'sigla', label: 'Estado', render: (r) => <span className="text-white">{r.sigla}</span> },
                    { key: 'gastos', label: 'Gasto', align: 'right', render: (r) => formatCurrency(r.gastos) },
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
