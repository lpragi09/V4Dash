import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;

  const META_CLIENT_ID = process.env.META_CLIENT_ID;
  if (!META_CLIENT_ID) {
    return NextResponse.json({ error: 'META_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/meta-agency/callback`;

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('ads_read,read_insights,business_management')}`;

  return NextResponse.redirect(authUrl);
}
