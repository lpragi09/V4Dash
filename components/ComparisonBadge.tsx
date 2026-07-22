import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonBadgeProps {
  current: number;
  previous: number;
  /** true quando um aumento é ruim (ex: custo, CPL, CPM) — inverte as cores. */
  invert?: boolean;
}

export default function ComparisonBadge({ current, previous, invert = false }: ComparisonBadgeProps) {
  if (!previous) {
    if (!current) return null;
    return <span className="text-xs text-zinc-500">Sem dado no mês anterior</span>;
  }

  const pct = ((current - previous) / previous) * 100;
  const isFlat = Math.abs(pct) < 0.5;
  const isUp = pct > 0;
  const isGood = isFlat ? null : invert ? !isUp : isUp;

  const color = isFlat ? 'text-zinc-500' : isGood ? 'text-emerald-500' : 'text-red-500';
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {isFlat ? '0%' : `${isUp ? '+' : ''}${pct.toFixed(1)}%`}
      <span className="text-zinc-500 font-normal">vs. mês anterior</span>
    </span>
  );
}
