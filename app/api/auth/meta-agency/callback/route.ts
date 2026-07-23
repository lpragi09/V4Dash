import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const META_CLIENT_ID = process.env.META_CLIENT_ID;
  const META_CLIENT_SECRET = process.env.META_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/meta-agency/callback`;

  try {
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_CLIENT_SECRET}&code=${code}`
    );
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Meta Agency OAuth Error:', tokenData.error);
      return NextResponse.redirect(`${origin}/dashboard/settings?error=meta_oauth_failed`);
    }

    // Troca o token de curta duração (~1-2h) por um de longa duração (~60 dias)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_CLIENT_ID}&client_secret=${META_CLIENT_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedResponse.json();

    const accessToken = longLivedData.access_token || tokenData.access_token;
    const expiresIn = longLivedData.expires_in || tokenData.expires_in;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('integracoes_agencia')
      .select('id')
      .eq('plataforma', 'meta_ads')
      .single();

    if (existing) {
      await supabase
        .from('integracoes_agencia')
        .update({ access_token: accessToken, token_expires_at: tokenExpiresAt })
        .eq('id', existing.id);
    } else {
      await supabase.from('integracoes_agencia').insert([
        { plataforma: 'meta_ads', access_token: accessToken, token_expires_at: tokenExpiresAt },
      ]);
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=meta_connected`);
  } catch (error) {
    console.error('Meta agency callback error:', error);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
  }
}
