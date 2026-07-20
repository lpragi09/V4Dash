import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { 
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';

// Force dynamic since it depends on params
export const dynamic = 'force-dynamic';

export default async function ClientOverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  // Fetch client details
  const { data: client, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !client) {
    notFound();
  }

  let dashboardData = null;
  let fetchError = null;

  try {
    if (!client.app_script_url) {
      throw new Error("Planilha de dados não vinculada a este cliente. Configure a URL nas Configurações Gerais.");
    }
    // Fetch data from Google Apps Script
    const response = await fetch(client.app_script_url, { 
      cache: 'no-store' // Sempre puxa os dados ao vivo sem cache
    });
    
    if (!response.ok) {
      throw new Error('Falha ao buscar dados da planilha');
    }
    
    const responseData = await response.json();
    
    if (responseData.error) {
      throw new Error(responseData.error);
    }
    
    dashboardData = responseData;
  } catch (err: any) {
    console.error("Error fetching App Script:", err);
    dashboardData = null;
    fetchError = err.message || "Erro ao conectar com a planilha do Google Drive. Verifique se a URL do Web App está correta e pública.";
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <LayoutDashboard className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">{client.nome}</h1>
          <p className="text-zinc-400">Acomp. Mensal</p>
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

      {dashboardData && dashboardData.visao_geral && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          
          {/* Revenue */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Receita CRM</h3>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.receita)}
            </p>
          </div>

          {/* Investment */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Investimento Ads</h3>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.investimento_total)}
            </p>
          </div>

          {/* Total Leads */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Leads Gerados</h3>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {dashboardData.visao_geral.leads_totais}
            </p>
          </div>

          {/* CPL */}
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6 hover:border-red-900/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Custo por Lead (Geral)</h3>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.cpl_geral)}
            </p>
          </div>

        </div>
      )}

      {/* Breakdown Section */}
      {dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 mt-8">
          
          {/* Meta vs Google Panel */}
          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Desempenho por Canal</h2>
            <div className="space-y-6">
              
              <div className="flex items-center justify-between p-4 bg-[#09090b] rounded-2xl border border-[#27272a]">
                <div>
                  <h3 className="text-blue-400 font-bold mb-1">Meta Ads</h3>
                  <p className="text-sm text-zinc-400">{dashboardData.meta_ads.leads} leads gerados</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatCurrency(dashboardData.meta_ads.gastos)}</p>
                  <p className="text-sm text-zinc-400">CPL: {formatCurrency(dashboardData.meta_ads.cpl)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#09090b] rounded-2xl border border-[#27272a]">
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">Google Ads</h3>
                  <p className="text-sm text-zinc-400">{dashboardData.google_ads.leads} leads gerados</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatCurrency(dashboardData.google_ads.gastos)}</p>
                  <p className="text-sm text-zinc-400">CPL: {formatCurrency(dashboardData.google_ads.cpl)}</p>
                </div>
              </div>

            </div>
          </div>

          {/* CRM Funnel */}
          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Funil do CRM</h2>
            <div className="space-y-4">
              
              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-zinc-400">Total de Oportunidades</span>
                <span className="text-white font-bold text-lg">{dashboardData.crm.oportunidades}</span>
              </div>
              
              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-emerald-500">Vendas Ganhas</span>
                <span className="text-emerald-400 font-bold text-lg">{dashboardData.crm.ganhas}</span>
              </div>

              <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex justify-between items-center">
                <span className="text-red-500">Oportunidades Perdidas</span>
                <span className="text-red-400 font-bold text-lg">{dashboardData.crm.perdidas}</span>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
