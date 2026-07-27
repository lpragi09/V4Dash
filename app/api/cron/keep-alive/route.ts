import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Faz uma leitura trivial no banco pra contar como atividade — projetos
 * gratuitos do Supabase pausam automaticamente depois de dias sem nenhuma
 * requisição. Roda uma vez por dia (ver vercel.json), num horário diferente
 * do /api/cron/sync-crm, como reforço independente disso.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('clientes').select('id').limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
