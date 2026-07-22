import type { SupabaseClient } from '@supabase/supabase-js';

async function refreshAgencyGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Falha ao renovar token do Google.');
  }
  return data;
}

/**
 * Retorna um access_token válido para a autorização Google Ads compartilhada
 * pela agência (não por cliente), renovando via refresh_token se necessário.
 * Retorna null se a agência ainda não autorizou ou a renovação falhar.
 */
export async function getValidAgencyGoogleToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: row } = await supabase
    .from('integracoes_agencia')
    .select('*')
    .eq('plataforma', 'google_ads')
    .maybeSingle();

  if (!row?.access_token || !row?.refresh_token) return null;

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < 5 * 60 * 1000;

  if (!isExpiringSoon) return row.access_token;

  try {
    const tokens = await refreshAgencyGoogleToken(row.refresh_token);
    await supabase
      .from('integracoes_agencia')
      .update({
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('id', row.id);
    return tokens.access_token;
  } catch (err) {
    console.error('Error refreshing agency Google token:', err);
    return null;
  }
}
