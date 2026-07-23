import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getValidAgencyGoogleToken } from '@/lib/google-agency';

interface CustomerClientRow {
  customerClient?: { id?: string; descriptiveName?: string };
}

export async function GET() {
  const supabase = await createClient();
  const accessToken = await getValidAgencyGoogleToken(supabase);

  if (!accessToken) {
    return NextResponse.json({ error: 'Google Ads não autorizado pela agência. Autorize em Configurações Gerais.' }, { status: 401 });
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const mccId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!developerToken) {
    return NextResponse.json({ error: 'GOOGLE_ADS_DEVELOPER_TOKEN não configurado no servidor.' }, { status: 500 });
  }
  if (!mccId) {
    return NextResponse.json({ error: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC) não configurado no servidor.' }, { status: 500 });
  }

  const cleanMccId = mccId.replace(/-/g, '');
  const query = `SELECT customer_client.id, customer_client.descriptive_name FROM customer_client WHERE customer_client.manager = false`;

  try {
    const res = await fetch(`https://googleads.googleapis.com/v25/customers/${cleanMccId}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'login-customer-id': cleanMccId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    const rawBody = await res.text();
    let body: { results?: CustomerClientRow[]; error?: { message?: string; status?: string; details?: unknown } } = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error('MCC accounts: failed to parse Google Ads response as JSON', {
        status: res.status,
        mccId: cleanMccId,
        rawBody: rawBody.slice(0, 500),
        parseErr,
      });
      return NextResponse.json({ error: `Resposta inválida da API do Google Ads (status ${res.status}).` }, { status: 500 });
    }

    if (!res.ok) {
      console.error('MCC accounts: Google Ads API error', { status: res.status, mccId: cleanMccId, body });
      return NextResponse.json({ error: body?.error?.message || `Erro na API do Google Ads (${res.status})` }, { status: 400 });
    }

    const rows: CustomerClientRow[] = body.results || [];
    const accounts = rows
      .filter((r) => r.customerClient?.id)
      .map((r) => ({
        account_id: String(r.customerClient!.id),
        name: r.customerClient!.descriptiveName || `Conta ${r.customerClient!.id}`,
      }));

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('MCC accounts: unexpected error', { mccId: cleanMccId, err });
    const message = err instanceof Error ? err.message : 'Erro ao buscar contas da MCC.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
