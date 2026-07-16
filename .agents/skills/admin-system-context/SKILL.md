---
name: admin-system-context
description: Contexto sobre a arquitetura do Sistema Admin, banco de dados (Supabase) e integrações via API (Meta Ads, Google, CRM).
---

# Contexto da Arquitetura: Sistema Admin (DashV4)

Este projeto passou por uma refatoração arquitetural (Fases 1 e 2 concluídas). **NÃO utilize planilhas do Google Apps Script como fonte de dados principal**. O sistema agora opera como um Admin autônomo conectando-se diretamente a APIs de plataformas de Ads/CRM.

## 1. Banco de Dados (Supabase)
O projeto utiliza Supabase como banco principal.
- **Tabela `clientes`**: Contém o ID (UUID) e nome do cliente. Substituiu a antiga tabela `agency_clients`.
- **Tabela `integracoes_clientes`**: Mapeia a conta de um cliente em uma plataforma de terceiros. Campos importantes: `cliente_id`, `plataforma` (ex: 'meta_ads', 'google_ads'), `conta_id` (ex: act_123456789).

## 2. Autenticação e Tokens
- Chaves do Supabase estão no `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- A aplicação utiliza `@supabase/ssr` (`utils/supabase/server.ts` e `client.ts`) para acessar o banco.
- Tokens globais da agência para acessar as plataformas (ex: `META_ACCESS_TOKEN`) devem ser lidos do `process.env` no servidor (Server Components ou Route Handlers). Não os exponha no cliente.

## 3. Páginas Principais
- `app/dashboard/settings/page.tsx`: **O Painel de Controle (Admin)**. É aqui que os clientes são criados, editados, e onde vinculamos o `conta_id` (ex: Meta Ads Account ID) a um cliente específico.
- `app/dashboard/[clientId]/*`: Páginas dinâmicas de relatórios. Elas leem o `conta_id` do banco e fazem fetch *server-side* direto para a API da plataforma (ex: Meta Graph API), retornando os dados para a UI.

## 4. Próximos Passos (Fase 3)
A próxima etapa do projeto é replicar a lógica do Meta Ads (já implementada) para o **Google Ads** e para o **Kommo CRM**:
1. Atualizar a UI do `settings/page.tsx` para permitir vincular também o ID do Google Ads e do CRM para cada cliente.
2. Refatorar as páginas `app/dashboard/[clientId]/google-ads/page.tsx` e `crm/page.tsx` para buscarem os dados das APIs reais.
