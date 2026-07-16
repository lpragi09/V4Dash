import { 
  BarChart,
  Target,
  MousePointerClick,
  Search
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Google Ads | Sistema ADM',
};

export default function GoogleAdsPage() {
  return (
    <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
      
      {/* HERO SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="max-w-xl">
          <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-500" />
            — GOOGLE ADS
          </p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-4">
            Métricas de <br />
            <span className="italic text-emerald-500">Busca & Display</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Acompanhe o retorno sobre investimento (ROAS) e performance de palavras-chave.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 min-w-[200px] flex flex-col justify-center">
            <span className="text-4xl font-bold text-white tracking-tight mb-2">0</span>
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">ROAS</span>
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
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">IMPRESSÕES</span>
            <span className="text-3xl font-bold text-white tracking-tight">0</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <MousePointerClick className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CPC MÉDIO</span>
            <span className="text-3xl font-bold text-white tracking-tight">R$ 0,00</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <Target className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CPA</span>
            <span className="text-3xl font-bold text-white tracking-tight">R$ 0,00</span>
          </div>
        </div>
      </div>

    </main>
  );
}
