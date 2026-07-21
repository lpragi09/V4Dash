'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-zinc-600 hover:text-zinc-300 transition-colors"
        aria-label="Mais informações"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {isOpen && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full left-0 mb-2 w-56 rounded-lg border border-[#27272a] bg-[#09090b] px-3 py-2 text-xs font-normal normal-case text-zinc-300 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}
