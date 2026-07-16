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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
          <Calendar className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-white mb-1">Acomp. Semanal</h1>
          <p className="text-zinc-400">Desempenho semanal de {client.nome}</p>
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

      {!fetchError && (
        <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-12 text-center">
          <h3 className="text-xl font-bold text-white mb-2">Estrutura Pronta</h3>
          <p className="text-zinc-400 max-w-lg mx-auto">
            A tela de Acompanhamento Semanal foi criada. Assim que configurarmos a leitura dessa aba específica no Google Apps Script, os dados aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
}
