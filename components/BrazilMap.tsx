'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BRAZIL_STATE_PATHS, BRAZIL_MAP_VIEWBOX } from '@/lib/brazil-states';

interface BrazilMapProps {
  /** Valor por sigla de estado (ex: { SP: 1234.5, MG: 987.2 }). */
  data: Record<string, number>;
  /** Formato do valor no tooltip ao passar o mouse — 'currency' ou 'number'. */
  format?: 'currency' | 'number';
  /** Cor de destaque em hex, ex: '#3b82f6' (azul, usado no Meta Ads). */
  accentColor?: string;
  /** Cidades por sigla de estado, pra mostrar no tooltip abaixo do total (top N já vem pronto de quem chama). */
  citiesByState?: Record<string, { nome: string; valor: number }[]>;
}

// Funções não podem ser passadas de Server Component pra Client Component —
// por isso o formato é uma string ('currency'/'number') e a formatação
// acontece aqui dentro, não recebida como prop.
const formatValue = (value: number, format: 'currency' | 'number'): string =>
  format === 'currency'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : new Intl.NumberFormat('pt-BR').format(value);

const TOOLTIP_WIDTH = 220;
const CURSOR_GAP = 14;
const EDGE_PADDING = 12;

interface HoverState {
  sigla: string;
  x: number;
  y: number;
}

/** Mapa coroplético do Brasil — cor mais forte = valor maior. Estados sem dado ficam cinza neutro. */
export default function BrazilMap({ data, format = 'currency', accentColor = '#3b82f6', citiesByState }: BrazilMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const values = Object.values(data).filter((v) => v > 0);
  const max = values.length > 0 ? Math.max(...values) : 0;

  const hoveredState = hover ? BRAZIL_STATE_PATHS.find((s) => s.sigla === hover.sigla) : null;
  const hoveredCities = hover ? citiesByState?.[hover.sigla] : undefined;

  // Tooltip próprio do site (portal), em vez do <title> nativo do SVG — alguns
  // navegadores/contextos não mostram o tooltip nativo do SVG de forma confiável.
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (hover && typeof window !== 'undefined') {
    tooltipLeft = hover.x + CURSOR_GAP;
    if (tooltipLeft + TOOLTIP_WIDTH > window.innerWidth - EDGE_PADDING) {
      tooltipLeft = hover.x - TOOLTIP_WIDTH - CURSOR_GAP;
    }
    tooltipLeft = Math.max(EDGE_PADDING, Math.min(tooltipLeft, window.innerWidth - TOOLTIP_WIDTH - EDGE_PADDING));
    tooltipTop = Math.min(hover.y + CURSOR_GAP, window.innerHeight - EDGE_PADDING);
  }

  return (
    <div className="relative">
      <svg viewBox={BRAZIL_MAP_VIEWBOX} className="w-full h-auto max-h-[420px]">
        {BRAZIL_STATE_PATHS.map((state) => {
          const value = data[state.sigla] || 0;
          const intensity = max > 0 ? value / max : 0;
          const fill = value > 0 ? accentColor : '#27272a';
          const fillOpacity = value > 0 ? 0.25 + intensity * 0.75 : 1;

          return (
            <path
              key={state.sigla}
              d={state.path}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke="#09090b"
              strokeWidth={0.8}
              className="transition-opacity hover:opacity-80 cursor-default"
              onMouseEnter={(e) => setHover({ sigla: state.sigla, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover((h) => (h?.sigla === state.sigla ? { sigla: state.sigla, x: e.clientX, y: e.clientY } : h))}
              onMouseLeave={() => setHover((h) => (h?.sigla === state.sigla ? null : h))}
            />
          );
        })}
      </svg>

      {hover &&
        hoveredState &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[100] pointer-events-none rounded-lg border border-[#27272a] bg-[#09090b] px-3 py-2.5 text-xs text-zinc-300 shadow-xl"
            style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
          >
            <p className="font-semibold text-white mb-1">
              {hoveredState.name}: {formatValue(data[hover.sigla] || 0, format)}
            </p>
            {hoveredCities && hoveredCities.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-[#27272a] space-y-0.5">
                {hoveredCities.map((city) => (
                  <p key={city.nome} className="flex justify-between gap-2">
                    <span>{city.nome}</span>
                    <span className="text-zinc-500">{formatValue(city.valor, format)}</span>
                  </p>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
