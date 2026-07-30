'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { GitBranch } from 'lucide-react';

interface Pipeline {
  id: number;
  name: string;
}

export default function PipelineFilter({ pipelines }: { pipelines: Pipeline[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPipeline = searchParams.get('pipeline');

  function selectPipeline(id: number | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === null) {
      params.delete('pipeline');
    } else {
      params.set('pipeline', String(id));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  if (pipelines.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
      <button
        type="button"
        onClick={() => selectPipeline(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          !currentPipeline
            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
            : 'bg-[#18181b]/80 border-[#27272a] text-zinc-400 hover:text-white hover:border-zinc-600'
        }`}
      >
        Todos os funis
      </button>
      {pipelines.map((pipeline) => (
        <button
          key={pipeline.id}
          type="button"
          onClick={() => selectPipeline(pipeline.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            currentPipeline === String(pipeline.id)
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
              : 'bg-[#18181b]/80 border-[#27272a] text-zinc-400 hover:text-white hover:border-zinc-600'
          }`}
        >
          {pipeline.name}
        </button>
      ))}
    </div>
  );
}
