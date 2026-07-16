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
    .eq('plataforma', 'google_ads')
    .single();

  if (!integration || !integration.access_token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Google Ads requires Developer Token to make API calls!
  const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!GOOGLE_DEVELOPER_TOKEN) {
    return NextResponse.json({ error: 'Developer token missing' }, { status: 500 });
  }

  try {
    const res = await fetch('https://googleads.googleapis.com/v15/customers:listAccessibleCustomers', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'developer-token': GOOGLE_DEVELOPER_TOKEN
      }
    });
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    // Google API returns { resourceNames: ["customers/1234567890", ...] }
    // We can extract just the IDs
    const accounts = (data.resourceNames || []).map((name: string) => {
      const id = name.replace('customers/', '');
      return { account_id: id, name: `Conta ${id}` };
    });

    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
