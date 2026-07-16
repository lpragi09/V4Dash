import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) return NextResponse.json({ error: 'Client ID required' }, { status: 400 });

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from('integracoes_clientes')
    .select('access_token')
    .eq('cliente_id', clientId)
    .eq('plataforma', 'meta_ads')
    .single();

  if (!integration || !integration.access_token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id&access_token=${integration.access_token}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ accounts: data.data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
