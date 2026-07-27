import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Settings,
  Wallet,
  PiggyBank,
  Ban,
  Users,
  XCircle,
  UserCog,
  Tags
} from 'lucide-react';
import Link from 'next/link';
import InfoTooltip from '@/components/InfoTooltip';
import TrendChart from '@/components/TrendChart';
import DataTable from '@/components/DataTable';
import {
  aggregateCrmLeads,
  aggregateBreakdowns,
  buildDailySeries,
  filterLeadsByDate,
  type KommoLeadSnapshot,
  type NamedRef,
} from '@/lib/kommo-crm';
import { resolveDateRange, datesInRange, rangeToUnix } from '@/lib/date-range';
import DateRangeFilter from '@/components/DateRangeFilter';

export const dynamic = 'force-dynamic';

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default async function CrmClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { clientId } = await params;
  const resolvedSearchParams = await searchParams;
  const hasCustomFilter = !!resolvedSearchParams.from && !!resolvedSearchParams.to;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) notFound();

  const { data: crmInt } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'crm')
    .single();

  const { data: snapshot } = await supabase
    .from('crm_snapshots')
    .select('*')
    .eq('cliente_id', clientId)
    .maybeSingle();

  let dashboardData = null;
  let fetchError = null;
  let atualizadoEm: string | null = null;
  let dailyLeads: { date: string; value: number }[] = [];
  let dailyWon: { date: string; value: number }[] = [];
  let lossReasonBreakdown: ReturnType<typeof aggregateBreakdowns>['lossReasonBreakdown'] = [];
  let responsibleBreakdown: ReturnType<typeof aggregateBreakdowns>['responsibleBreakdown'] = [];
  let tagBreakdown: ReturnType<typeof aggregateBreakdowns>['tagBreakdown'] = [];

  if (!crmInt?.conta_id || !crmInt?.access_token) {
    fetchError = 'Conta de CRM não vinculada a este cliente. Configure em Configurações Gerais.';
  } else if (!snapshot) {
    fetchError = 'Ainda não há dados sincronizados desse CRM. A primeira sincronização roda logo após conectar — se acabou de conectar, aguarde alguns instantes e atualize a página.';
  } else {
    const leads = (snapshot.leads || []) as KommoLeadSnapshot[];
    const recentLeads = (snapshot.recent_leads || []) as KommoLeadSnapshot[];
    const naoFechouIds = (snapshot.nao_fechou_ids || []) as number[];
    const lossReasons = (snapshot.loss_reasons || []) as NamedRef[];
    const users = (snapshot.users || []) as NamedRef[];

    let leadsForBreakdown = leads;

    if (hasCustomFilter) {
      // Com filtro aplicado, os cards passam a refletir só o período
      // selecionado (em vez do histórico completo) — usa "leads" (histórico
      // inteiro) porque o período pode ser mais antigo que os 31 dias
      // garantidos em "recent_leads".
      const range = resolveDateRange(resolvedSearchParams, 30);
      const { fromUnix, toUnix } = rangeToUnix(range);
      dashboardData = aggregateCrmLeads(leads, naoFechouIds, fromUnix, toUnix);
      const series = buildDailySeries(leads, datesInRange(range));
      dailyLeads = series.dailyLeads;
      dailyWon = series.dailyWon;
      leadsForBreakdown = filterLeadsByDate(leads, fromUnix, toUnix);
    } else {
      // Sem filtro: cards mostram o histórico completo, gráficos mostram os
      // últimos 30 dias (comportamento padrão de sempre).
      dashboardData = aggregateCrmLeads(leads, naoFechouIds);
      const series = buildDailySeries(recentLeads, lastNDates(30));
      dailyLeads = series.dailyLeads;
      dailyWon = series.dailyWon;
    }

    const breakdowns = aggregateBreakdowns(leadsForBreakdown, lossReasons, users);
    lossReasonBreakdown = breakdowns.lossReasonBreakdown;
    responsibleBreakdown = breakdowns.responsibleBreakdown;
    tagBreakdown = breakdowns.tagBreakdown;
    atualizadoEm = snapshot.atualizado_em;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <MessageSquare className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração CRM</h1>
            <p className="text-zinc-400">
              Funil de Vendas de {client.nome}
              {hasCustomFilter ? ' — período selecionado' : ' — histórico completo'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DateRangeFilter />
          {atualizadoEm && (
            <p className="text-xs text-zinc-500 shrink-0">Atualizado em {formatDateTime(atualizadoEm)}</p>
          )}
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
          {!crmInt?.conta_id && (
             <Link href="/dashboard/settings" className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
               <Settings className="w-4 h-4" />
               Vincular Conta em Configurações
             </Link>
          )}
        </div>
      )}

      {dashboardData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  Total de Oportunidades
                  <InfoTooltip text="Número total de leads/negócios registrados no CRM no período." />
                </span>
                <Briefcase className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{dashboardData.oportunidades}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative group">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 transition-colors group-hover:bg-emerald-500/10" />
              <h3 className="text-emerald-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                <span className="flex items-center gap-1.5">
                  Leads Ganhos
                  <InfoTooltip text="Leads/negócios marcados como ganhos no funil do CRM. Não corresponde necessariamente ao número de vendas únicas — um mesmo cliente pode gerar mais de um lead ganho." />
                </span>
                <TrendingUp className="w-5 h-5 text-emerald-500/50" />
              </h3>
              <p className="text-4xl font-bold text-emerald-400 relative z-10">{dashboardData.ganhas}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative group">
              <div className="absolute inset-0 rounded-2xl bg-red-500/5 transition-colors group-hover:bg-red-500/10" />
              <h3 className="text-red-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                <span className="flex items-center gap-1.5">
                  Oportunidades Perdidas
                  <InfoTooltip text="Negócios marcados como perdidos no período." />
                </span>
                <AlertCircle className="w-5 h-5 text-red-500/50" />
              </h3>
              <p className="text-4xl font-bold text-red-400 relative z-10">{dashboardData.perdidas}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  Valor dos Leads Ganhos
                  <InfoTooltip text="Soma do valor de todos os leads marcados como ganhos no funil. É o valor dos negócios ganhos no CRM, não uma contagem auditada de vendas — um mesmo cliente pode ter mais de um lead ganho." />
                </span>
                <Wallet className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{formatCurrency(dashboardData.valorGanho)}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  Valor em Pipeline
                  <InfoTooltip text="Soma do valor dos negócios ainda em andamento (nem ganhos, nem perdidos, nem no estágio 'Não Fechou')." />
                </span>
                <PiggyBank className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{formatCurrency(dashboardData.valorPipeline)}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative group">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/5 transition-colors group-hover:bg-amber-500/10" />
              <h3 className="text-amber-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                <span className="flex items-center gap-1.5">
                  Não Fechou
                  <InfoTooltip text="Negócios no estágio 'Não Fechou' do funil. Não contam como ganho nem como pipeline ativo — ficam à parte por não representarem receita nem oportunidade em andamento." />
                </span>
                <Ban className="w-5 h-5 text-amber-500/50" />
              </h3>
              <p className="text-4xl font-bold text-amber-400 relative z-10">{formatCurrency(dashboardData.valorNaoFechou)}</p>
              <p className="text-sm text-zinc-500 mt-1 relative z-10">{dashboardData.naoFechou} leads</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative group">
              <div className="absolute inset-0 rounded-2xl bg-blue-500/5 transition-colors group-hover:bg-blue-500/10" />
              <h3 className="text-blue-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                <span className="flex items-center gap-1.5">
                  Vendas
                  <InfoTooltip text="Clientes únicos com pelo menos um lead ganho — diferente de 'Leads Ganhos', não duplica o mesmo cliente que teve mais de um negócio fechado." />
                </span>
                <Users className="w-5 h-5 text-blue-500/50" />
              </h3>
              <p className="text-4xl font-bold text-blue-400 relative z-10">{dashboardData.vendas}</p>
              <p className="text-sm text-zinc-500 mt-1 relative z-10">clientes únicos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Leads Criados por Dia</h3>
              <TrendChart series={[{ name: 'Leads', color: 'orange', points: dailyLeads }]} />
            </div>
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Valor Ganho por Dia</h3>
              <TrendChart
                series={[{ name: 'Valor Ganho', color: 'emerald', points: dailyWon }]}
                format="currency"
              />
            </div>
          </div>

          {lossReasonBreakdown.length > 0 && (
            <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Motivos de Perda
                <InfoTooltip text="Motivo cadastrado no Kommo pra cada negócio marcado como perdido, cada motivo separado." />
              </h2>
              <DataTable
                getRowKey={(row: (typeof lossReasonBreakdown)[number]) => row.motivo}
                rows={lossReasonBreakdown}
                columns={[
                  { key: 'motivo', label: 'Motivo', render: (r) => <span className="text-white">{r.motivo}</span> },
                  { key: 'quantidade', label: 'Leads Perdidos', align: 'right', render: (r) => r.quantidade },
                  { key: 'valor', label: 'Valor Perdido', align: 'right', render: (r) => formatCurrency(r.valor) },
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {responsibleBreakdown.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-zinc-500" />
                  Performance por Responsável
                  <InfoTooltip text="Oportunidades, leads ganhos e valor ganho separados por responsável no Kommo." />
                </h2>
                <DataTable
                  getRowKey={(row: (typeof responsibleBreakdown)[number]) => row.responsavel}
                  rows={responsibleBreakdown}
                  columns={[
                    { key: 'responsavel', label: 'Responsável', render: (r) => <span className="text-white">{r.responsavel}</span> },
                    { key: 'oportunidades', label: 'Oportunidades', align: 'right', render: (r) => r.oportunidades },
                    { key: 'ganhas', label: 'Ganhas', align: 'right', render: (r) => r.ganhas },
                    { key: 'valorGanho', label: 'Valor Ganho', align: 'right', render: (r) => formatCurrency(r.valorGanho) },
                  ]}
                />
              </div>
            )}

            {tagBreakdown.length > 0 && (
              <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Tags className="w-5 h-5 text-zinc-500" />
                  Tags mais usadas
                  <InfoTooltip text="Tags aplicadas aos leads no Kommo, cada uma separada — top 20." />
                </h2>
                <DataTable
                  getRowKey={(row: (typeof tagBreakdown)[number]) => row.tag}
                  rows={tagBreakdown}
                  columns={[
                    { key: 'tag', label: 'Tag', render: (r) => <span className="text-white">{r.tag}</span> },
                    { key: 'quantidade', label: 'Leads', align: 'right', render: (r) => r.quantidade },
                  ]}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
