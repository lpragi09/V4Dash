import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncClientCrmSnapshot } from '@/lib/kommo-crm';

export const dynamic = 'force-dynamic';

/**
 * Roda uma vez por dia (ver vercel.json) e atualiza o snapshot do CRM de
 * cada cliente conectado ao Kommo. Protegido por CRON_SECRET pra não deixar
 * qualquer um disparar buscas na API do Kommo só de bater nessa URL.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: integracoes, error } = await supabase
    .from('integracoes_clientes')
    .select('cliente_id, conta_id, access_token')
    .eq('plataforma', 'crm');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { clienteId: string; status: 'ok' | 'erro'; detalhe?: string }[] = [];

  for (const integracao of integracoes || []) {
    if (!integracao.conta_id || !integracao.access_token) continue;
    try {
      await syncClientCrmSnapshot(supabase, integracao.cliente_id, integracao.conta_id, integracao.access_token);
      results.push({ clienteId: integracao.cliente_id, status: 'ok' });
    } catch (err) {
      results.push({
        clienteId: integracao.cliente_id,
        status: 'erro',
        detalhe: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  return NextResponse.json({ sincronizados: results.length, results });
}
