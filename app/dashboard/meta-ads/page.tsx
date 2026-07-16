import { 
  BarChart,
  Target,
  MousePointerClick,
  Activity
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Meta Ads | Sistema ADM',
};

export default function MetaAdsPage() {
  return (
    <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
      
      {/* HERO SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="max-w-xl">
          <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            — META ADS
          </p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-4">
            Anúncios <br />
            <span className="italic text-blue-500">Facebook & Instagram</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Desempenho detalhado das suas campanhas nas redes sociais.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 min-w-[200px] flex flex-col justify-center">
            <span className="text-4xl font-bold text-white tracking-tight mb-2">0</span>
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CAMPANHAS ATIVAS</span>
          </div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <BarChart className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">ALCANCE</span>
            <span className="text-3xl font-bold text-white tracking-tight">0</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <MousePointerClick className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CPM</span>
            <span className="text-3xl font-bold text-white tracking-tight">R$ 0,00</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <Target className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CTR</span>
            <span className="text-3xl font-bold text-white tracking-tight">0%</span>
          </div>
        </div>
      </div>

    </main>
  );
}
