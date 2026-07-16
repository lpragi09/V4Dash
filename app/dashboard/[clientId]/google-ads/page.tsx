import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { 
  Search,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Activity
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GoogleAdsClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !client) notFound();

  let dashboardData = null;
  let fetchError = null;

  try {
    const response = await fetch(client.app_script_url, { cache: 'no-store' });
    const responseData = await response.json();
    if (responseData.error) throw new Error(responseData.error);
    dashboardData = responseData;
  } catch (err: any) {
    dashboardData = null;
    fetchError = err.message || "Erro ao conectar com a planilha.";
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const google = dashboardData?.google_ads;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Search className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">bd Google Ads</h1>
          <p className="text-zinc-400">Desempenho de campanhas de {client.nome}</p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
          <div>
            <h3 className="text-red-400 font-bold text-lg mb-1">Erro de Conexão</h3>
            <p className="text-red-200/70">{fetchError}</p>
          </div>
        </div>
      )}

      {google && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Gastos (Google)
                <DollarSign className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(google.gastos)}</p>
            </div>
            
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Leads (Google)
                <Users className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{google.leads}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Custo por Lead
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrency(google.cpl)}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Cliques
                <Activity className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-3xl font-bold text-white mb-2">{google.cliques}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
