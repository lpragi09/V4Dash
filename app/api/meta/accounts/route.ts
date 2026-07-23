import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getValidAgencyMetaToken } from '@/lib/meta-agency';

interface MetaAdAccountRow {
  account_id?: string;
  name?: string;
  business?: { name?: string };
}

export async function GET() {
  const supabase = await createClient();
  const accessToken = await getValidAgencyMetaToken(supabase);

  if (!accessToken) {
    return NextResponse.json({ error: 'Meta Ads não autorizado pela agência. Autorize em Configurações Gerais.' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,business{name}&limit=200&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      console.error('Meta accounts error:', data.error);
      return NextResponse.json({ error: data.error.message || 'Erro ao buscar contas do Meta.' }, { status: 400 });
    }

    const rows: MetaAdAccountRow[] = data.data || [];
    const accounts = rows
      .filter((r) => r.account_id)
      .map((r) => ({
        account_id: r.account_id!,
        name: r.name || `Conta ${r.account_id}`,
        business_name: r.business?.name || 'Sem Business Manager',
      }));

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('Meta accounts: unexpected error', err);
    return NextResponse.json({ error: 'Erro ao buscar contas do Meta.' }, { status: 500 });
  }
}
