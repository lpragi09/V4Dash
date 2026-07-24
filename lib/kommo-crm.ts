import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Toda a leitura de leads do Kommo fica centralizada aqui e roda só uma vez
 * por dia (via /api/cron/sync-crm), não mais a cada carregamento de página —
 * era isso que causava rate limit (429) na API do Kommo quando várias pessoas
 * abriam o dashboard ao mesmo tempo. As páginas leem o snapshot já pronto no
 * Supabase (tabela crm_snapshots).
 */

const STATUS_GANHO = 142;
const STATUS_PERDIDO = 143;

export interface KommoLeadSnapshot {
  status_id: number;
  price?: number;
  created_at?: number;
  closed_at?: number;
  contact_id?: number;
}

export interface CrmAggregate {
  oportunidades: number;
  ganhas: number;
  perdidas: number;
  naoFechou: number;
  vendas: number;
  valorGanho: number;
  valorPipeline: number;
  valorNaoFechou: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllKommoLeads(
  domain: string,
  accessToken: string,
  createdAfterUnix?: number
): Promise<KommoLeadSnapshot[]> {
  const limit = 250;
  const batchSize = 3;
  const maxPages = 20;
  const allLeads: KommoLeadSnapshot[] = [];
  let page = 1;

  while (page <= maxPages) {
    const pagesInBatch = Array.from({ length: batchSize }, (_, i) => page + i).filter((p) => p <= maxPages);

    const results = await Promise.all(
      pagesInBatch.map(async (p) => {
        const url = new URL(`https://${domain}/api/v4/leads`);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('page', String(p));
        url.searchParams.set('with', 'contacts');
        if (createdAfterUnix) {
          url.searchParams.set('filter[created_at][from]', String(createdAfterUnix));
        }

        let attempt = 0;
        while (true) {
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (res.status === 204) return [] as KommoLeadSnapshot[];
          if (res.status === 429 && attempt < 5) {
            const retryAfter = Number(res.headers.get('Retry-After')) || 2;
            await sleep(retryAfter * 1000 * (attempt + 1));
            attempt += 1;
            continue;
          }
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}) as Record<string, string>);
            throw new Error(errBody.title || errBody.hint || `Erro ao buscar leads do Kommo (${res.status})`);
          }
          const json = await res.json();
          const leads = (json._embedded?.leads || []) as Array<{
            status_id: number;
            price?: number;
            created_at?: number;
            closed_at?: number;
            _embedded?: { contacts?: Array<{ id: number; is_main?: boolean }> };
          }>;
          return leads.map((lead) => {
            const contacts = lead._embedded?.contacts || [];
            const mainContact = contacts.find((c) => c.is_main) || contacts[0];
            return {
              status_id: lead.status_id,
              price: lead.price,
              created_at: lead.created_at,
              closed_at: lead.closed_at,
              contact_id: mainContact?.id,
            };
          });
        }
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

/**
 * "Não Fechou" é um estágio customizado por conta/funil (não o status global
 * de perdido) — identificamos pelo nome do estágio em vez de um ID fixo.
 */
async function fetchNaoFechouStatusIds(domain: string, accessToken: string): Promise<number[]> {
  try {
    const res = await fetch(`https://${domain}/api/v4/leads/pipelines`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const pipelines = json._embedded?.pipelines || [];
    const normalize = (s: string) =>
      s.toLowerCase().trim().replace(/ã/g, 'a').replace(/á/g, 'a').replace(/â/g, 'a').replace(/ç/g, 'c');
    const ids = new Set<number>();
    for (const pipeline of pipelines) {
      const statuses = pipeline._embedded?.statuses || [];
      for (const status of statuses) {
        if (normalize(status.name || '') === 'nao fechou') {
          ids.add(status.id);
        }
      }
    }
    return Array.from(ids);
  } catch {
    return [];
  }
}

/**
 * Busca tudo do Kommo pra um cliente e grava o snapshot no Supabase.
 * Guarda dois recortes: "leads" (histórico inteiro, até o teto de paginação —
 * usado nos totais gerais) e "recentLeads" (últimos 31 dias, filtrado direto
 * na API do Kommo — garante que os gráficos/recortes de 7d e 30d fiquem
 * completos mesmo se o histórico total ultrapassar o teto de paginação).
 */
export async function syncClientCrmSnapshot(
  supabase: SupabaseClient,
  clienteId: string,
  domain: string,
  accessToken: string
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 31);
  const cutoffUnix = Math.floor(cutoffDate.getTime() / 1000);

  const [naoFechouIds, leads, recentLeads] = await Promise.all([
    fetchNaoFechouStatusIds(domain, accessToken),
    fetchAllKommoLeads(domain, accessToken),
    fetchAllKommoLeads(domain, accessToken, cutoffUnix),
  ]);

  const { error } = await supabase.from('crm_snapshots').upsert(
    {
      cliente_id: clienteId,
      leads,
      recent_leads: recentLeads,
      nao_fechou_ids: naoFechouIds,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'cliente_id' }
  );
  if (error) throw new Error(`Erro ao salvar snapshot do CRM: ${error.message}`);
}

export function aggregateCrmLeads(
  leads: KommoLeadSnapshot[],
  naoFechouIds: number[],
  createdAfterUnix?: number
): CrmAggregate {
  const naoFechouSet = new Set(naoFechouIds);
  const clientesGanhos = new Set<number>();
  let oportunidades = 0, ganhas = 0, perdidas = 0, naoFechou = 0;
  let valorGanho = 0, valorPipeline = 0, valorNaoFechou = 0;

  for (const lead of leads) {
    if (createdAfterUnix && (!lead.created_at || lead.created_at < createdAfterUnix)) continue;
    oportunidades += 1;
    if (lead.status_id === STATUS_GANHO) {
      ganhas += 1;
      valorGanho += lead.price || 0;
      if (lead.contact_id) clientesGanhos.add(lead.contact_id);
    } else if (lead.status_id === STATUS_PERDIDO) {
      perdidas += 1;
    } else if (naoFechouSet.has(lead.status_id)) {
      naoFechou += 1;
      valorNaoFechou += lead.price || 0;
    } else {
      valorPipeline += lead.price || 0;
    }
  }

  return { oportunidades, ganhas, perdidas, naoFechou, vendas: clientesGanhos.size, valorGanho, valorPipeline, valorNaoFechou };
}

export function buildDailySeries(
  leads: KommoLeadSnapshot[],
  dateRange: string[]
): { dailyLeads: { date: string; value: number }[]; dailyWon: { date: string; value: number }[] } {
  const unixToDate = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
  const dailyLeadsCount = new Map<string, number>();
  const dailyWonValue = new Map<string, number>();
  const cutoff = dateRange.length > 0 ? new Date(dateRange[0]).getTime() / 1000 : 0;

  for (const lead of leads) {
    if (lead.created_at && lead.created_at >= cutoff) {
      const day = unixToDate(lead.created_at);
      dailyLeadsCount.set(day, (dailyLeadsCount.get(day) || 0) + 1);
    }
    if (lead.status_id === STATUS_GANHO && lead.closed_at && lead.closed_at >= cutoff) {
      const day = unixToDate(lead.closed_at);
      dailyWonValue.set(day, (dailyWonValue.get(day) || 0) + (lead.price || 0));
    }
  }

  return {
    dailyLeads: dateRange.map((d) => ({ date: d, value: dailyLeadsCount.get(d) || 0 })),
    dailyWon: dateRange.map((d) => ({ date: d, value: dailyWonValue.get(d) || 0 })),
  };
}
