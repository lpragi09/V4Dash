import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { 
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Settings
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CrmClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) notFound();

  // Busca a integração do CRM
  const { data: crmInt } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'crm')
    .single();

  const crmAccountId = crmInt?.conta_id;
  const accessToken = process.env.CRM_ACCESS_TOKEN;

  let dashboardData = null;
  let fetchError = null;

  if (!crmAccountId) {
    fetchError = "Conta de CRM não vinculada a este cliente. Configure em Configurações Gerais.";
  } else if (!accessToken) {
    fetchError = "Token de Acesso do CRM (CRM_ACCESS_TOKEN) não configurado no servidor.";
  } else {
    try {
      // TODO: Substituir por chamada real para a API do Kommo CRM.
      // Exemplo de payload mockado para fins de design
      dashboardData = {
        oportunidades: 120,
        ganhas: 45,
        perdidas: 12
      };
    } catch (err: any) {
      dashboardData = null;
      fetchError = err.message || "Erro ao conectar com a API do CRM.";
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
          <MessageSquare className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Integração CRM</h1>
          <p className="text-zinc-400">Funil de Vendas de {client.nome}</p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-2xl p-6 flex flex-col items-start gap-4">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="text-red-400 font-bold text-lg mb-1">Ação Necessária</h3>
              <p className="text-red-200/70">{fetchError}</p>
            </div>
          </div>
          {!crmAccountId && (
             <Link href="/dashboard/settings" className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
               <Settings className="w-4 h-4" />
               Vincular Conta em Configurações
             </Link>
          )}
        </div>
      )}

      {dashboardData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6">
              <h3 className="text-zinc-400 font-medium mb-4 flex items-center justify-between">
                Total de Oportunidades
                <Briefcase className="w-5 h-5 text-zinc-500" />
              </h3>
              <p className="text-4xl font-bold text-white mb-2">{dashboardData.oportunidades}</p>
            </div>
            
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/5 transition-colors group-hover:bg-emerald-500/10" />
              <h3 className="text-emerald-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                Vendas Ganhas
                <TrendingUp className="w-5 h-5 text-emerald-500/50" />
              </h3>
              <p className="text-4xl font-bold text-emerald-400 relative z-10">{dashboardData.ganhas}</p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-red-500/5 transition-colors group-hover:bg-red-500/10" />
              <h3 className="text-red-400/70 font-medium mb-4 flex items-center justify-between relative z-10">
                Oportunidades Perdidas
                <AlertCircle className="w-5 h-5 text-red-500/50" />
              </h3>
              <p className="text-4xl font-bold text-red-400 relative z-10">{dashboardData.perdidas}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
