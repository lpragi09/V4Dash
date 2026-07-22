'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

const TOOLTIP_WIDTH = 224; // w-56
const GAP = 8;
const EDGE_PADDING = 16;

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Abre para o lado (não para cima/baixo) e com posição calculada via
  // getBoundingClientRect, renderizado em portal — assim nunca fica preso
  // por overflow do card nem cobre o valor logo abaixo do ícone.
  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    let left = rect.right + GAP;
    if (left + TOOLTIP_WIDTH > window.innerWidth - EDGE_PADDING) {
      left = rect.left - TOOLTIP_WIDTH - GAP;
    }
    left = Math.max(EDGE_PADDING, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - EDGE_PADDING));

    const top = Math.max(EDGE_PADDING, rect.top - 4);

    setCoords({ top, left });
  };

  const open = () => {
    updatePosition();
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        className="text-zinc-600 hover:text-zinc-300 transition-colors"
        aria-label="Mais informações"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[100] pointer-events-none rounded-lg border border-[#27272a] bg-[#09090b] px-3 py-2 text-xs font-normal normal-case text-zinc-300 shadow-xl"
            style={{ top: coords.top, left: coords.left, width: TOOLTIP_WIDTH }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
