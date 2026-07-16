import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const clientId = searchParams.get('state');

  if (!code || !clientId) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || '',
        client_secret: GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google OAuth Error:', tokenData.error);
      return NextResponse.redirect(`${origin}/dashboard/settings?error=google_oauth_failed`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const supabase = await createClient();

    // Check if integration already exists
    const { data: existingInt } = await supabase
      .from('integracoes_clientes')
      .select('id')
      .eq('cliente_id', clientId)
      .eq('plataforma', 'google_ads')
      .single();

    if (existingInt) {
      await supabase
        .from('integracoes_clientes')
        .update({ 
          access_token: accessToken,
          ...(refreshToken && { refresh_token: refreshToken }) // Only update refresh token if present
        })
        .eq('id', existingInt.id);
    } else {
      await supabase
        .from('integracoes_clientes')
        .insert([{ 
          cliente_id: clientId, 
          plataforma: 'google_ads', 
          access_token: accessToken,
          refresh_token: refreshToken
        }]);
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=google_connected`);
  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
  }
}
