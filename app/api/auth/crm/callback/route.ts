import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const clientId = searchParams.get('state');
  const referer = searchParams.get('referer');

  if (!code || !clientId) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const KOMMO_CLIENT_ID = process.env.KOMMO_CLIENT_ID;
  const KOMMO_CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/crm/callback`;

  // Kommo envia o subdomínio da conta autorizada no referer
  const kommoDomain = referer || 'www.kommo.com';

  try {
    const tokenResponse = await fetch(`https://${kommoDomain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: KOMMO_CLIENT_ID,
        client_secret: KOMMO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();

    if (tokenData.status === 400 || tokenData.title === 'Error') {
      console.error('Kommo OAuth Error:', tokenData);
      return NextResponse.redirect(`${origin}/dashboard/settings?error=crm_oauth_failed`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const supabase = await createClient();

    const { data: existingInt } = await supabase
      .from('integracoes_clientes')
      .select('id')
      .eq('cliente_id', clientId)
      .eq('plataforma', 'crm')
      .single();

    // Para CRM, não tem 'conta_id' para selecionar depois, a conta é o próprio domínio!
    // Então já podemos preencher o conta_id com o domínio
    if (existingInt) {
      await supabase
        .from('integracoes_clientes')
        .update({ 
          access_token: accessToken,
          ...(refreshToken && { refresh_token: refreshToken }),
          conta_id: kommoDomain,
          configuracoes_extras: { domain: kommoDomain }
        })
        .eq('id', existingInt.id);
    } else {
      await supabase
        .from('integracoes_clientes')
        .insert([{ 
          cliente_id: clientId, 
          plataforma: 'crm', 
          conta_id: kommoDomain,
          access_token: accessToken,
          refresh_token: refreshToken,
          configuracoes_extras: { domain: kommoDomain }
        }]);
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=crm_connected`);
  } catch (error) {
    console.error('Kommo callback error:', error);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
  }
}
