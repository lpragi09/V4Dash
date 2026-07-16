import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  const KOMMO_CLIENT_ID = process.env.KOMMO_CLIENT_ID;
  if (!KOMMO_CLIENT_ID) {
    return NextResponse.json({ error: 'KOMMO_CLIENT_ID not configured' }, { status: 500 });
  }

  const state = clientId;
  const authUrl = `https://www.kommo.com/oauth?client_id=${KOMMO_CLIENT_ID}&state=${state}&mode=popup`;

  return NextResponse.redirect(authUrl);
}
