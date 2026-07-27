'use client';

import { BRAZIL_STATE_PATHS, BRAZIL_MAP_VIEWBOX } from '@/lib/brazil-states';

interface BrazilMapProps {
  /** Valor por sigla de estado (ex: { SP: 1234.5, MG: 987.2 }). */
  data: Record<string, number>;
  /** Formato do valor no tooltip ao passar o mouse — 'currency' ou 'number'. */
  format?: 'currency' | 'number';
  /** Cor de destaque em hex, ex: '#3b82f6' (azul, usado no Meta Ads). */
  accentColor?: string;
}

// Funções não podem ser passadas de Server Component pra Client Component —
// por isso o formato é uma string ('currency'/'number') e a formatação
// acontece aqui dentro, não recebida como prop.
const formatValue = (value: number, format: 'currency' | 'number'): string =>
  format === 'currency'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : new Intl.NumberFormat('pt-BR').format(value);

/** Mapa coroplético do Brasil — cor mais forte = valor maior. Estados sem dado ficam cinza neutro. */
export default function BrazilMap({ data, format = 'currency', accentColor = '#3b82f6' }: BrazilMapProps) {
  const values = Object.values(data).filter((v) => v > 0);
  const max = values.length > 0 ? Math.max(...values) : 0;

  return (
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
            className="transition-opacity hover:opacity-80"
          >
            <title>
              {state.name}: {formatValue(value, format)}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
