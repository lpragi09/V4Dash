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
  loss_reason_id?: number;
  responsible_user_id?: number;
  tags?: string[];
}

export interface NamedRef {
  id: number;
  name: string;
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
        url.searchParams.set('with', 'contacts,tags');
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
            loss_reason_id?: number;
            responsible_user_id?: number;
            _embedded?: {
              contacts?: Array<{ id: number; is_main?: boolean }>;
              tags?: Array<{ name: string }>;
            };
          }>;
          return leads.map((lead) => {
            const contacts = lead._embedded?.contacts || [];
            const mainContact = contacts.find((c) => c.is_main) || contacts[0];
            const tags = (lead._embedded?.tags || []).map((t) => t.name).filter(Boolean);
            return {
              status_id: lead.status_id,
              price: lead.price,
              created_at: lead.created_at,
              closed_at: lead.closed_at,
              contact_id: mainContact?.id,
              loss_reason_id: lead.loss_reason_id,
              responsible_user_id: lead.responsible_user_id,
              tags: tags.length > 0 ? tags : undefined,
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

async function fetchLossReasons(domain: string, accessToken: string): Promise<NamedRef[]> {
  try {
    const res = await fetch(`https://${domain}/api/v4/leads/loss_reasons`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const reasons = (json._embedded?.loss_reasons || []) as Array<{ id: number; name: string }>;
    return reasons.map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

async function fetchUsers(domain: string, accessToken: string): Promise<NamedRef[]> {
  try {
    const res = await fetch(`https://${domain}/api/v4/users?limit=250`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const users = (json._embedded?.users || []) as Array<{ id: number; name: string }>;
    return users.map((u) => ({ id: u.id, name: u.name }));
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

  const [naoFechouIds, leads, recentLeads, lossReasons, users] = await Promise.all([
    fetchNaoFechouStatusIds(domain, accessToken),
    fetchAllKommoLeads(domain, accessToken),
    fetchAllKommoLeads(domain, accessToken, cutoffUnix),
    fetchLossReasons(domain, accessToken),
    fetchUsers(domain, accessToken),
  ]);

  const { error } = await supabase.from('crm_snapshots').upsert(
    {
      cliente_id: clienteId,
      leads,
      recent_leads: recentLeads,
      nao_fechou_ids: naoFechouIds,
      loss_reasons: lossReasons,
      users,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'cliente_id' }
  );
  if (error) throw new Error(`Erro ao salvar snapshot do CRM: ${error.message}`);
}

export function aggregateCrmLeads(
  leads: KommoLeadSnapshot[],
  naoFechouIds: number[],
  createdAfterUnix?: number,
  createdBeforeUnix?: number
): CrmAggregate {
  const naoFechouSet = new Set(naoFechouIds);
  const clientesGanhos = new Set<number>();
  let oportunidades = 0, ganhas = 0, perdidas = 0, naoFechou = 0;
  let valorGanho = 0, valorPipeline = 0, valorNaoFechou = 0;

  for (const lead of leads) {
    if (createdAfterUnix && (!lead.created_at || lead.created_at < createdAfterUnix)) continue;
    if (createdBeforeUnix && (!lead.created_at || lead.created_at > createdBeforeUnix)) continue;
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

export function filterLeadsByDate(
  leads: KommoLeadSnapshot[],
  createdAfterUnix?: number,
  createdBeforeUnix?: number
): KommoLeadSnapshot[] {
  if (!createdAfterUnix && !createdBeforeUnix) return leads;
  return leads.filter((lead) => {
    if (createdAfterUnix && (!lead.created_at || lead.created_at < createdAfterUnix)) return false;
    if (createdBeforeUnix && (!lead.created_at || lead.created_at > createdBeforeUnix)) return false;
    return true;
  });
}

export interface LossReasonBreakdown {
  motivo: string;
  quantidade: number;
  valor: number;
}

export interface ResponsibleBreakdown {
  responsavel: string;
  oportunidades: number;
  ganhas: number;
  valorGanho: number;
}

export interface TagBreakdown {
  tag: string;
  quantidade: number;
}

/**
 * Motivos de perda, performance por responsável e tags mais usadas — cada um
 * separado, sem somar com as outras métricas do funil.
 */
export function aggregateBreakdowns(
  leads: KommoLeadSnapshot[],
  lossReasons: NamedRef[],
  users: NamedRef[]
): { lossReasonBreakdown: LossReasonBreakdown[]; responsibleBreakdown: ResponsibleBreakdown[]; tagBreakdown: TagBreakdown[] } {
  const lossReasonNames = new Map(lossReasons.map((r) => [r.id, r.name]));
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const lossMap = new Map<string, LossReasonBreakdown>();
  const responsibleMap = new Map<string, ResponsibleBreakdown>();
  const tagMap = new Map<string, number>();

  for (const lead of leads) {
    if (lead.status_id === STATUS_PERDIDO) {
      const motivo = lead.loss_reason_id ? lossReasonNames.get(lead.loss_reason_id) || 'Sem motivo definido' : 'Sem motivo definido';
      const entry = lossMap.get(motivo) || { motivo, quantidade: 0, valor: 0 };
      entry.quantidade += 1;
      entry.valor += lead.price || 0;
      lossMap.set(motivo, entry);
    }

    const responsavel = lead.responsible_user_id ? userNames.get(lead.responsible_user_id) || 'Desconhecido' : 'Sem responsável';
    const respEntry = responsibleMap.get(responsavel) || { responsavel, oportunidades: 0, ganhas: 0, valorGanho: 0 };
    respEntry.oportunidades += 1;
    if (lead.status_id === STATUS_GANHO) {
      respEntry.ganhas += 1;
      respEntry.valorGanho += lead.price || 0;
    }
    responsibleMap.set(responsavel, respEntry);

    for (const tag of lead.tags || []) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }

  return {
    lossReasonBreakdown: Array.from(lossMap.values()).sort((a, b) => b.quantidade - a.quantidade),
    responsibleBreakdown: Array.from(responsibleMap.values()).sort((a, b) => b.valorGanho - a.valorGanho),
    tagBreakdown: Array.from(tagMap.entries())
      .map(([tag, quantidade]) => ({ tag, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 20),
  };
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
