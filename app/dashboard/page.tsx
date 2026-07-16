import { Users } from 'lucide-react';

export default function DashboardIndex() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 min-h-screen">
      <div className="w-24 h-24 bg-red-950/30 rounded-full flex items-center justify-center border border-red-900/50 mb-6 mx-auto">
        <Users className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-3xl font-serif font-bold text-white mb-4">Bem-vindo ao Dash-V4 Interno</h1>
      <p className="text-zinc-400 max-w-md mx-auto text-lg">
        Selecione um cliente na barra lateral esquerda para visualizar o painel de métricas, Meta Ads, Google Ads e CRM.
      </p>
    </div>
  );
}
