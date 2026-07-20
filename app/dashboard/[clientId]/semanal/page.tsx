import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { 
  Calendar,
  AlertCircle
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SemanalClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !client) notFound();

  let fetchError = null;

  // Busca integrações
  const { data: integrations } = await supabase
    .from('integracoes_clientes')
    .select('*')
    .eq('cliente_id', clientId);

  const metaInt = integrations?.find(i => i.plataforma === 'meta_ads');
  const googleInt = integrations?.find(i => i.plataforma === 'google_ads');
  const crmInt = integrations?.find(i => i.plataforma === 'crm');

  let metaData = { gastos: 0, leads: 0, cpl: 0 };
  let googleData = { gastos: 0, leads: 0, cpl: 0 };
  let crmData = { oportunidades: 0, ganhas: 0, perdidas: 0 };

  // Fetch Meta (Últimos 7 dias)
  if (metaInt?.access_token && metaInt?.conta_id) {
    try {
      const normalizedAccountId = metaInt.conta_id.startsWith('act_') ? metaInt.conta_id : `act_${metaInt.conta_id}`;
      const url = `https://graph.facebook.com/v19.0/${normalizedAccountId}/insights?access_token=${metaInt.access_token}&date_preset=last_7d&fields=spend,actions`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      
      const insights = json.data && json.data.length > 0 ? json.data[0] : null;
      
      let leadsCount = 0;
      if (insights?.actions) {
        const leadAction = insights.actions.find((a: any) => a.action_type === 'lead');
        if (leadAction) leadsCount = parseInt(leadAction.value);
      }
      const spend = insights ? parseFloat(insights.spend || '0') : 0;
      
      metaData = {
        gastos: spend,
        leads: leadsCount,
        cpl: leadsCount > 0 ? spend / leadsCount : 0
      };
    } catch(err) {
      console.error("Error fetching Meta Ads:", err);
    }
  }

  // Fetch Google (Mock)
  if (googleInt?.access_token && googleInt?.conta_id) {
    googleData = { gastos: 350.50, leads: 12, cpl: 350.50 / 12 };
  }

  // Fetch CRM (Mock)
  if (crmInt?.access_token) {
    crmData = { oportunidades: 35, ganhas: 8, perdidas: 4 };
  }

  // Aggregate Data
  const totalGastos = metaData.gastos + googleData.gastos;
  const totalLeads = metaData.leads + googleData.leads;
  const cplGeral = totalLeads > 0 ? totalGastos / totalLeads : 0;
  const receitaCRM = crmData.ganhas * 1500;

  const dashboardData = {
    visao_geral: {
      receita: receitaCRM,
      investimento_total: totalGastos,
      leads_totais: totalLeads,
      cpl_geral: cplGeral
    },
    meta_ads: metaData,
    google_ads: googleData,
    crm: crmData
  };

  if (!metaInt?.access_token && !googleInt?.access_token && !crmInt?.access_token) {
    fetchError = "Nenhuma integração conectada. Vá em Configurações Gerais para vincular Meta Ads, Google Ads e Kommo CRM.";
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
          <Calendar className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Acomp. Semanal</h1>
          <p className="text-zinc-400">Desempenho dos últimos 7 dias de {client.nome}</p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
          <div>
            <h3 className="text-red-400 font-bold text-lg mb-1">Ação Necessária</h3>
            <p className="text-red-200/70">{fetchError}</p>
          </div>
        </div>
      )}

      {(!fetchError && dashboardData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          
          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Receita 7d</h3>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.receita)}
            </p>
          </div>

          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Investimento 7d</h3>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.investimento_total)}
            </p>
          </div>

          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">Leads 7d</h3>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {dashboardData.visao_geral.leads_totais}
            </p>
          </div>

          <div className="bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-400 font-medium">CPL 7d</h3>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatCurrency(dashboardData.visao_geral.cpl_geral)}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
