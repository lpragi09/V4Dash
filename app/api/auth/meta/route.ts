import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  const META_CLIENT_ID = process.env.META_CLIENT_ID;
  if (!META_CLIENT_ID) {
    return NextResponse.json({ error: 'META_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/meta/callback`;
  const state = clientId;

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=ads_read,read_insights`;

  return NextResponse.redirect(authUrl);
}
