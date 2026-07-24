/**
 * Utilitários compartilhados pelo filtro de período (calendário) que aparece
 * no topo das páginas de dashboard. O período fica na URL (?from=&to=) pra
 * poder ser compartilhado/atualizado sem perder estado ao recarregar.
 */

export interface DateRange {
  since: string;
  until: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve o período a partir dos searchParams da URL, caindo pro padrão
 * (últimos N dias, incluindo hoje) quando não há filtro customizado aplicado.
 */
export function resolveDateRange(
  searchParams: { from?: string; to?: string } | undefined,
  defaultDays: number
): DateRange {
  const from = searchParams?.from;
  const to = searchParams?.to;
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    return from <= to ? { since: from, until: to } : { since: to, until: from };
  }

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (defaultDays - 1));
  return { since: fmt(since), until: fmt(until) };
}

/** Janela imediatamente anterior, com a mesma duração — pra comparação. */
export function previousDateRange(range: DateRange): DateRange {
  const since = new Date(range.since);
  const until = new Date(range.until);
  const days = Math.round((until.getTime() - since.getTime()) / 86_400_000) + 1;

  const prevUntil = new Date(since);
  prevUntil.setDate(prevUntil.getDate() - 1);
  const prevSince = new Date(prevUntil);
  prevSince.setDate(prevSince.getDate() - (days - 1));

  return { since: fmt(prevSince), until: fmt(prevUntil) };
}

/** Todas as datas (YYYY-MM-DD) entre since e until, inclusive. */
export function datesInRange(range: DateRange): string[] {
  const dates: string[] = [];
  const cur = new Date(range.since);
  const end = new Date(range.until);
  while (cur <= end) {
    dates.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Unix timestamp (segundos) do início do dia `since` e fim do dia `until`. */
export function rangeToUnix(range: DateRange): { fromUnix: number; toUnix: number } {
  const fromUnix = Math.floor(new Date(`${range.since}T00:00:00Z`).getTime() / 1000);
  const toUnix = Math.floor(new Date(`${range.until}T23:59:59Z`).getTime() / 1000);
  return { fromUnix, toUnix };
}
