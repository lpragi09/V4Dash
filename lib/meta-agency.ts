import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retorna o access_token do Meta Ads compartilhado pela agência, se ainda
 * válido. Diferente do Google, o Meta não usa refresh_token — o token de
 * longa duração dura ~60 dias e precisa ser reautorizado manualmente quando
 * expirar (não existe renovação silenciosa no fluxo de OAuth do Meta).
 */
export async function getValidAgencyMetaToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: row } = await supabase
    .from('integracoes_agencia')
    .select('*')
    .eq('plataforma', 'meta_ads')
    .maybeSingle();

  if (!row?.access_token) return null;

  if (row.token_expires_at) {
    const expiresAt = new Date(row.token_expires_at).getTime();
    if (expiresAt - Date.now() < 0) return null;
  }

  return row.access_token;
}
