import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Settings,
  Wallet,
  PiggyBank
} from 'lucide-react';
import Link from 'next/link';
import InfoTooltip from '@/components/InfoTooltip';
import TrendChart from '@/components/TrendChart';

export const dynamic = 'force-dynamic';

interface KommoLead {
  status_id: number;
  price?: number;
  created_at?: number;
  closed_at?: number;
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

function alignSeries(dates: string[], counts: Map<string, number>): { date: string; value: number }[] {
  return dates.map((d) => ({ date: d, value: counts.get(d) || 0 }));
}

function unixToDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
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
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}) as Record<string, string>);
          throw new Error(errBody.title || errBody.hint || `Erro ao buscar leads do Kommo (${res.status})`);
        }
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

export default async function CrmClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) notFound();

  // Busca a integração do CRM
  const { data: crmInt } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'crm')
    .single();

  const crmAccountId = crmInt?.conta_id;
  const accessToken = crmInt?.access_token;

  let dashboardData = null;
  let fetchError = null;
  const dateRange = lastNDates(30);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.getTime() / 1000;
  const dailyLeadsCount = new Map<string, number>();
  const dailyWonValue = new Map<string, number>();

  if (!crmAccountId) {
    fetchError = "Conta de CRM não vinculada a este cliente. Configure em Configurações Gerais.";
  } else if (!accessToken) {
    fetchError = "Token de Acesso do CRM não encontrado para este cliente.";
  } else {
    const STATUS_GANHO = 142;
    const STATUS_PERDIDO = 143;

    try {
      let oportunidades = 0;
      let ganhas = 0;
      let perdidas = 0;
      let valorGanho = 0;
      let valorPipeline = 0;

      const leads = await fetchAllKommoLeads(crmAccountId, accessToken);

      for (const lead of leads) {
        oportunidades += 1;
        if (lead.status_id === STATUS_GANHO) {
          ganhas += 1;
          valorGanho += lead.price || 0;
        } else if (lead.status_id === STATUS_PERDIDO) {
          perdidas += 1;
        } else {
          valorPipeline += lead.price || 0;
        }

        // Buckets diários (últimos 30 dias) para os gráficos
        if (lead.created_at && lead.created_at >= cutoff) {
          const day = unixToDate(lead.created_at);
          dailyLeadsCount.set(day, (dailyLeadsCount.get(day) || 0) + 1);
        }
        if (lead.status_id === STATUS_GANHO && lead.closed_at && lead.closed_at >= cutoff) {
          const day = unixToDate(lead.closed_at);
          dailyWonValue.set(day, (dailyWonValue.get(day) || 0) + (lead.price || 0));
        }
      }

      dashboardData = { oportunidades, ganhas, perdidas, valorGanho, valorPipeline };
    } catch (err) {
      dashboardData = null;
      fetchError = err instanceof Error ? err.message : "Erro ao conectar com a API do CRM.";
    }
  }

  const dailyLeads = alignSeries(dateRange, dailyLeadsCount);
  const dailyWon = alignSeries(dateRange, dailyWonValue);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
          <MessageSquare className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração CRM</h1>
          <p className="text-zinc-400">Funil de Vendas de {client.nome}</p>
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
          {!crmAccountId && (
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
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
                  Vendas Ganhas
                  <InfoTooltip text="Negócios marcados como ganhos (venda concluída) no período." />
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
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Valor Ganho
                  <InfoTooltip text="Soma do valor de todos os negócios marcados como ganhos." />
                </span>
                <Wallet className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{formatCurrency(dashboardData.valorGanho)}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Valor em Pipeline
                  <InfoTooltip text="Soma do valor dos negócios ainda em andamento (nem ganhos, nem perdidos)." />
                </span>
                <PiggyBank className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{formatCurrency(dashboardData.valorPipeline)}</p>
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
        </>
      )}
    </div>
  );
}
