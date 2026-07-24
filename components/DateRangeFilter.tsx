'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, X } from 'lucide-react';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(monthsAgo: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d;
}

function endOfMonth(monthsAgo: number): Date {
  const d = startOfMonth(monthsAgo);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Hoje', range: () => ({ from: fmt(daysAgo(0)), to: fmt(daysAgo(0)) }) },
  { label: 'Ontem', range: () => ({ from: fmt(daysAgo(1)), to: fmt(daysAgo(1)) }) },
  { label: '7 dias', range: () => ({ from: fmt(daysAgo(6)), to: fmt(daysAgo(0)) }) },
  { label: '30 dias', range: () => ({ from: fmt(daysAgo(29)), to: fmt(daysAgo(0)) }) },
  { label: 'Este mês', range: () => ({ from: fmt(startOfMonth(0)), to: fmt(daysAgo(0)) }) },
  { label: 'Mês passado', range: () => ({ from: fmt(startOfMonth(1)), to: fmt(endOfMonth(1)) }) },
];

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFrom = searchParams.get('from');
  const currentTo = searchParams.get('to');
  const hasCustomFilter = !!currentFrom && !!currentTo;

  const [customFrom, setCustomFrom] = useState(currentFrom || fmt(daysAgo(29)));
  const [customTo, setCustomTo] = useState(currentTo || fmt(daysAgo(0)));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function applyRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from);
    params.set('to', to);
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  }

  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    params.delete('to');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setIsOpen(false);
  }

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.from === currentFrom && r.to === currentTo;
  });

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => {
            const r = preset.range();
            applyRange(r.from, r.to);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            activePreset?.label === preset.label
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
              : 'bg-[#18181b]/80 border-[#27272a] text-zinc-400 hover:text-white hover:border-zinc-600'
          }`}
        >
          {preset.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          hasCustomFilter && !activePreset
            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
            : 'bg-[#18181b]/80 border-[#27272a] text-zinc-400 hover:text-white hover:border-zinc-600'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {hasCustomFilter && !activePreset
          ? `${formatDisplay(currentFrom!)} - ${formatDisplay(currentTo!)}`
          : 'Personalizado'}
      </button>

      {hasCustomFilter && (
        <button
          type="button"
          onClick={clearFilter}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-white transition-colors"
          aria-label="Limpar filtro de período"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-20 bg-[#18181b] border border-[#27272a] rounded-xl p-4 shadow-xl flex flex-col gap-3 w-64">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">De</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Até</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={fmt(daysAgo(0))}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => applyRange(customFrom, customTo)}
            className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
