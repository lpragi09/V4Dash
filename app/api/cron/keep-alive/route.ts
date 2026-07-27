import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Faz uma leitura trivial no banco pra contar como atividade — projetos
 * gratuitos do Supabase pausam automaticamente depois de dias sem nenhuma
 * requisição. Sem segredo de propósito: só faz um SELECT inofensivo, então
 * dá pra apontar qualquer serviço externo de cron (cron-job.org, UptimeRobot
 * etc.) direto nessa URL, sem precisar configurar header nenhum. Também roda
 * via cron interno da Vercel (ver vercel.json) como redundância.
 */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from('clientes').select('id').limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
