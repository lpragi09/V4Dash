import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, subdomain, integrationId, secretKey, authCode, redirectUri } = body;

    if (!clientId || !subdomain || !integrationId || !secretKey || !authCode) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 });
    }

    // Clean subdomain just in case user inputs full URL
    const cleanSubdomain = subdomain.replace(/^https?:\/\//, '').replace(/\.kommo\.com.*$/, '').trim();
    const fullDomain = `${cleanSubdomain}.kommo.com`;

    const tokenResponse = await fetch(`https://${fullDomain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: integrationId.trim(),
        client_secret: secretKey.trim(),
        grant_type: 'authorization_code',
        code: authCode.trim(),
        redirect_uri: redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();

    if (tokenData.status === 400 || tokenData.title === 'Error') {
      console.error('Kommo token exchange error:', tokenData);
      return NextResponse.json({ error: tokenData.detail || 'Falha ao trocar o código. Verifique se ele já não expirou (dura apenas 20 minutos).' }, { status: 400 });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    const supabase = await createClient();

    // Check if integration already exists
    const { data: existingInt } = await supabase
      .from('integracoes_clientes')
      .select('id')
      .eq('cliente_id', clientId)
      .eq('plataforma', 'crm')
      .single();

    const configExtras = {
      domain: fullDomain,
      client_id: integrationId.trim(),
      client_secret: secretKey.trim()
    };

    if (existingInt) {
      await supabase
        .from('integracoes_clientes')
        .update({ 
          access_token: accessToken,
          refresh_token: refreshToken,
          conta_id: fullDomain,
          configuracoes_extras: configExtras
        })
        .eq('id', existingInt.id);
    } else {
      await supabase
        .from('integracoes_clientes')
        .insert([{ 
          cliente_id: clientId, 
          plataforma: 'crm', 
          conta_id: fullDomain,
          access_token: accessToken,
          refresh_token: refreshToken,
          configuracoes_extras: configExtras
        }]);
    }

    return NextResponse.json({ success: true, domain: fullDomain });

  } catch (error: any) {
    console.error('Error connecting to Kommo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor ao tentar conectar com Kommo.' }, { status: 500 });
  }
}
