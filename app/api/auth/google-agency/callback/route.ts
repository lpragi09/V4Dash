import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/google-agency/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || '',
        client_secret: GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google Agency OAuth Error:', tokenData);
      return NextResponse.redirect(`${origin}/dashboard/settings?error=google_oauth_failed`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('integracoes_agencia')
      .select('id')
      .eq('plataforma', 'google_ads')
      .single();

    if (existing) {
      await supabase
        .from('integracoes_agencia')
        .update({
          access_token: accessToken,
          ...(refreshToken && { refresh_token: refreshToken }),
          token_expires_at: tokenExpiresAt,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('integracoes_agencia').insert([
        {
          plataforma: 'google_ads',
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
        },
      ]);
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=google_connected`);
  } catch (error) {
    console.error('Google agency callback error:', error);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
  }
}
