import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const clientId = searchParams.get('state');

  if (!code || !clientId) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const META_CLIENT_ID = process.env.META_CLIENT_ID;
  const META_CLIENT_SECRET = process.env.META_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/meta/callback`;

  try {
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_CLIENT_SECRET}&code=${code}`
    );
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Meta OAuth Error:', tokenData.error);
      return NextResponse.redirect(`${origin}/dashboard/settings?error=meta_oauth_failed`);
    }

    const accessToken = tokenData.access_token;
    const supabase = await createClient();

    // Check if integration already exists
    const { data: existingInt } = await supabase
      .from('integracoes_clientes')
      .select('id')
      .eq('cliente_id', clientId)
      .eq('plataforma', 'meta_ads')
      .single();

    if (existingInt) {
      await supabase
        .from('integracoes_clientes')
        .update({ access_token: accessToken })
        .eq('id', existingInt.id);
    } else {
      await supabase
        .from('integracoes_clientes')
        .insert([{ cliente_id: clientId, plataforma: 'meta_ads', access_token: accessToken }]);
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=meta_connected`);
  } catch (error) {
    console.error('Meta callback error:', error);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
  }
}
