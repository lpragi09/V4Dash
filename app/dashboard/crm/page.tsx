import { 
  Users,
  CheckCircle2,
  PhoneCall,
  Clock
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CRM | Sistema ADM',
};

export default function CRMPage() {
  return (
    <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
      
      {/* HERO SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="max-w-xl">
          <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            — GESTÃO DE CLIENTES
          </p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-4">
            Pipeline de <br />
            <span className="italic text-purple-500">Vendas (CRM)</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Acompanhe o status das negociações e o fluxo de leads gerados pelas campanhas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 min-w-[200px] flex flex-col justify-center">
            <span className="text-4xl font-bold text-white tracking-tight mb-2">0</span>
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">NEGOCIAÇÕES ABERTAS</span>
          </div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <PhoneCall className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">CONTATADOS</span>
            <span className="text-3xl font-bold text-white tracking-tight">0</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <Clock className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">TEMPO MÉDIO DE RESPOSTA</span>
            <span className="text-3xl font-bold text-white tracking-tight">0h</span>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between h-40 hover:border-zinc-700 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-[#27272a] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-zinc-300" />
          </div>
          <div className="flex items-end justify-between mt-auto">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">VENDAS FECHADAS</span>
            <span className="text-3xl font-bold text-white tracking-tight">0</span>
          </div>
        </div>
      </div>

    </main>
  );
}
