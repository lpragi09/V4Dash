/* eslint-disable @next/next/no-html-link-for-pages */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Trash2, Edit2, Loader2, Save, X, Building, LogOut, Activity, Search, MessageSquare, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';

interface Client {
  id: string;
  nome: string;
  meta_ads_account_id?: string;
  meta_connected?: boolean;
  google_ads_account_id?: string;
  google_connected?: boolean;
  crm_account_id?: string;
  crm_connected?: boolean;
}

interface AdAccount {
  account_id: string;
  name: string;
}

function SettingsContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for adding client
  const [isAdding, setIsAdding] = useState(false);
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for editing client name
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  // States for selected client and its connections
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [metaId, setMetaId] = useState('');
  const [googleId, setGoogleId] = useState('');
  
  const [metaAccounts, setMetaAccounts] = useState<AdAccount[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState({ meta: false, google: false });
  const [isSavingConnections, setIsSavingConnections] = useState(false);

  // Kommo manual connection states
  const [kommoSubdomain, setKommoSubdomain] = useState('');
  const [kommoIntegrationId, setKommoIntegrationId] = useState('');
  const [kommoSecretKey, setKommoSecretKey] = useState('');
  const [kommoAuthCode, setKommoAuthCode] = useState('');
  const [isConnectingKommo, setIsConnectingKommo] = useState(false);
  const [kommoError, setKommoError] = useState('');
  const [isKommoModalOpen, setIsKommoModalOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleConnectKommo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    setIsConnectingKommo(true);
    setKommoError('');

    try {
      const res = await fetch('/api/crm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          subdomain: kommoSubdomain,
          integrationId: kommoIntegrationId,
          secretKey: kommoSecretKey,
          authCode: kommoAuthCode,
          redirectUri: window.location.origin
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar ao Kommo.');

      await fetchClients(true);
      setKommoSubdomain('');
      setKommoIntegrationId('');
      setKommoSecretKey('');
      setKommoAuthCode('');
      setIsKommoModalOpen(false);
    } catch (error: any) {
      setKommoError(error.message);
    }
    setIsConnectingKommo(false);
  };

  const handleSelectClient = (id: string, clientsList = clients) => {
    const client = clientsList.find(c => c.id === id);
    if (client) {
      setSelectedClientId(id);
      setMetaId(client.meta_ads_account_id || '');
      setGoogleId(client.google_ads_account_id || '');

      // Fetch accounts if connected
      if (client.meta_connected) {
        setLoadingAccounts(prev => ({ ...prev, meta: true }));
        fetch(`/api/meta/accounts?clientId=${id}`)
          .then(res => res.json())
          .then(data => {
            if (data.accounts) setMetaAccounts(data.accounts);
            setLoadingAccounts(prev => ({ ...prev, meta: false }));
          }).catch(() => setLoadingAccounts(prev => ({ ...prev, meta: false })));
      } else {
        setMetaAccounts([]);
      }

      if (client.google_connected) {
        setLoadingAccounts(prev => ({ ...prev, google: true }));
        fetch(`/api/google/accounts?clientId=${id}`)
          .then(res => res.json())
          .then(data => {
            if (data.accounts) setGoogleAccounts(data.accounts);
            setLoadingAccounts(prev => ({ ...prev, google: false }));
          }).catch(() => setLoadingAccounts(prev => ({ ...prev, google: false })));
      } else {
        setGoogleAccounts([]);
      }
    }
  };

  const fetchClients = async (preserveSelection = true) => {
    const { data: clientsData } = await supabase
      .from('clientes')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (clientsData) {
      const { data: integrations } = await supabase
        .from('integracoes_clientes')
        .select('*')
        .in('plataforma', ['meta_ads', 'google_ads', 'crm']);

      const mergedClients = clientsData.map(client => {
        const metaInt = integrations?.find(i => i.cliente_id === client.id && i.plataforma === 'meta_ads');
        const googleInt = integrations?.find(i => i.cliente_id === client.id && i.plataforma === 'google_ads');
        const crmInt = integrations?.find(i => i.cliente_id === client.id && i.plataforma === 'crm');
        
        return {
          ...client,
          meta_ads_account_id: metaInt?.conta_id || '',
          meta_connected: !!metaInt?.access_token,
          google_ads_account_id: googleInt?.conta_id || '',
          google_connected: !!googleInt?.access_token,
          crm_account_id: crmInt?.conta_id || '',
          crm_connected: !!crmInt?.access_token
        };
      });
      setClients(mergedClients);

      if (preserveSelection && selectedClientId) {
        handleSelectClient(selectedClientId, mergedClients);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClients();
    
    const successMsg = searchParams.get('success');
    const errorMsg = searchParams.get('error');
    if (successMsg || errorMsg) {
      // Remove query params after reading
      router.replace('/dashboard/settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setIsSubmitting(true);
    
    const { data: newClient, error } = await supabase
      .from('clientes')
      .insert([{ nome }])
      .select()
      .single();

    if (newClient && !error) {
      setNome('');
      setIsAdding(false);
      await fetchClients(false);
      setSelectedClientId(newClient.id);
      router.refresh(); 
    }
    
    setIsSubmitting(false);
  };

  const handleUpdateName = async (id: string) => {
    if (!editNome.trim()) return;
    setIsSubmitting(true);
    
    await supabase
      .from('clientes')
      .update({ nome: editNome })
      .eq('id', id);

    setEditingNameId(null);
    await fetchClients();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este cliente? Todos os dados serão perdidos.')) {
      await supabase.from('clientes').delete().eq('id', id);
      if (selectedClientId === id) setSelectedClientId(null);
      await fetchClients();
      router.refresh();
    }
  };

  const handleDisconnect = async (plataforma: 'meta_ads' | 'google_ads' | 'crm') => {
    if (!selectedClientId) return;
    if (!confirm('Tem certeza que deseja desconectar essa plataforma? Você vai precisar autorizar de novo.')) return;

    await supabase
      .from('integracoes_clientes')
      .delete()
      .eq('cliente_id', selectedClientId)
      .eq('plataforma', plataforma);

    if (plataforma === 'meta_ads') { setMetaId(''); setMetaAccounts([]); }
    if (plataforma === 'google_ads') { setGoogleId(''); setGoogleAccounts([]); }

    await fetchClients(true);
    router.refresh();
  };

  const handleSaveConnections = async () => {
    if (!selectedClientId) return;
    setIsSavingConnections(true);

    const syncAccountId = async (plataforma: string, contaId: string) => {
      if (contaId.trim()) {
        await supabase
          .from('integracoes_clientes')
          .update({ conta_id: contaId.trim() })
          .eq('cliente_id', selectedClientId)
          .eq('plataforma', plataforma);
      }
    };

    if (metaId) await syncAccountId('meta_ads', metaId);
    if (googleId) await syncAccountId('google_ads', googleId);

    await fetchClients();
    router.refresh();
    setIsSavingConnections(false);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="p-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-white mb-2">Configurações Gerais</h1>
        <p className="text-zinc-400">Gerencie a sua agência, preferências e as conexões de cada cliente.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Client Management */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl text-white">Gestão de Clientes</h2>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Adicionar</>}
              </button>
            </div>

            {isAdding && (
              <form onSubmit={handleAddClient} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Nome do Cliente</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 transition-colors text-sm"
                    placeholder="Nome do novo cliente"
                  />
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center min-w-[80px]"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                  </button>
                </div>
              </form>
            )}

            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 bg-[#09090b] border border-[#27272a] rounded-xl">
                <p className="text-zinc-500 text-sm">Nenhum cliente cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {clients.map(client => (
                  <div 
                    key={client.id} 
                    onClick={() => handleSelectClient(client.id)}
                    className={`group cursor-pointer border rounded-xl p-3 transition-all ${
                      selectedClientId === client.id 
                        ? 'bg-red-500/10 border-red-500/50' 
                        : 'bg-[#09090b] border-[#27272a] hover:border-zinc-700'
                    }`}
                  >
                    {editingNameId === client.id ? (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleUpdateName(client.id); }} className="p-1.5 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 rounded-lg">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingNameId(null); }} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className={`font-bold ${selectedClientId === client.id ? 'text-red-400' : 'text-white'}`}>
                            {client.nome}
                          </h3>
                          <div className="flex gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${client.meta_connected ? 'bg-blue-500' : 'bg-zinc-800'}`} title="Meta Ads" />
                            <span className={`w-2 h-2 rounded-full ${client.google_connected ? 'bg-emerald-500' : 'bg-zinc-800'}`} title="Google Ads" />
                            <span className={`w-2 h-2 rounded-full ${client.crm_connected ? 'bg-orange-500' : 'bg-zinc-800'}`} title="CRM" />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNameId(client.id);
                              setEditNome(client.nome);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(client.id);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <ChevronRight className={`w-5 h-5 ml-2 transition-colors ${selectedClientId === client.id ? 'text-red-500' : 'text-zinc-700'}`} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4 text-white">
              <LogOut className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-lg">Sessão</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Encerre a sua sessão atual com segurança no painel administrativo.
            </p>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="w-full py-3 bg-red-600/10 text-red-500 border border-red-900/50 hover:bg-red-600 hover:text-white rounded-xl font-medium transition-colors"
            >
              Sair da Conta
            </button>
          </div>
        </div>

        {/* Right Column: Connection Settings */}
        <div className="lg:col-span-7">
          {selectedClient ? (
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 animate-in slide-in-from-right-8 duration-500">
              <div className="mb-8 pb-6 border-b border-[#27272a]">
                <h2 className="text-2xl font-bold text-white mb-2">Conexões de Plataforma</h2>
                <p className="text-zinc-400">
                  Integre e vincule as contas de anúncios para o cliente <strong className="text-white">{selectedClient.nome}</strong>.
                </p>
              </div>

              <div className="space-y-6">
                {/* Meta Ads Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Meta Ads</h3>
                      <p className="text-xs text-zinc-500">Facebook e Instagram</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full flex flex-col items-start gap-3">
                    {!selectedClient.meta_connected ? (
                      <a 
                        href={`/api/auth/meta?clientId=${selectedClient.id}`} 
                        className="inline-flex items-center justify-center w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                      >
                        Autorizar com Facebook
                      </a>
                    ) : (
                      <div className="w-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-500">Autorizado</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisconnect('meta_ads')}
                            className="text-xs text-zinc-500 hover:text-red-500 transition-colors underline underline-offset-2"
                          >
                            Desconectar
                          </button>
                        </div>
                        {loadingAccounts.meta ? (
                          <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas...
                          </div>
                        ) : (
                          <select 
                            value={metaId}
                            onChange={(e) => setMetaId(e.target.value)}
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          >
                            <option value="">Selecione uma conta de anúncios</option>
                            {metaAccounts.map(acc => (
                              <option key={acc.account_id} value={acc.account_id}>
                                {acc.name} ({acc.account_id})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Ads Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Search className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Google Ads</h3>
                      <p className="text-xs text-zinc-500">Pesquisa e YouTube</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full flex flex-col items-start gap-3">
                    {!selectedClient.google_connected ? (
                      <a 
                        href={`/api/auth/google?clientId=${selectedClient.id}`} 
                        className="inline-flex items-center justify-center w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        Autorizar com Google
                      </a>
                    ) : (
                      <div className="w-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-500">Autorizado</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisconnect('google_ads')}
                            className="text-xs text-zinc-500 hover:text-red-500 transition-colors underline underline-offset-2"
                          >
                            Desconectar
                          </button>
                        </div>
                        {loadingAccounts.google ? (
                          <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas...
                          </div>
                        ) : (
                          <select 
                            value={googleId}
                            onChange={(e) => setGoogleId(e.target.value)}
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                          >
                            <option value="">Selecione uma conta de anúncios</option>
                            {googleAccounts.map(acc => (
                              <option key={acc.account_id} value={acc.account_id}>
                                {acc.name} ({acc.account_id})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Kommo CRM Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Kommo CRM</h3>
                      <p className="text-xs text-zinc-500">Gestão de Vendas</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full flex flex-col items-start gap-3">
                    {!selectedClient.crm_connected ? (
                      <button
                        type="button"
                        onClick={() => setIsKommoModalOpen(true)}
                        className="inline-flex items-center justify-center w-full md:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-orange-500/20"
                      >
                        Conectar ao Kommo
                      </button>
                    ) : (
                      <div className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-sm font-semibold text-white">CRM Conectado</span>
                          <span className="text-xs text-zinc-500">({selectedClient.crm_account_id})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDisconnect('crm')}
                          className="text-xs text-zinc-500 hover:text-red-500 transition-colors underline underline-offset-2"
                        >
                          Desconectar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Só mostrar o botão de salvar se tivermos Dropdowns para salvar */}
              {(selectedClient.meta_connected || selectedClient.google_connected) && (
                <div className="mt-8 flex justify-end pt-6 border-t border-[#27272a]">
                  <button 
                    onClick={handleSaveConnections}
                    disabled={isSavingConnections}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
                  >
                    {isSavingConnections ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Contas Selecionadas
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-[#27272a] rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-[#18181b]/50">
              <div className="w-16 h-16 bg-[#27272a] rounded-2xl flex items-center justify-center mb-4">
                <Building className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Selecione um Cliente</h3>
              <p className="text-zinc-400 max-w-sm">
                Escolha um cliente na lista ao lado para autorizar e vincular contas.
              </p>
            </div>
          )}
        </div>

      </div>

      {selectedClient && (
        <Modal
          isOpen={isKommoModalOpen}
          onClose={() => setIsKommoModalOpen(false)}
          title={`Conectar Kommo — ${selectedClient.nome}`}
        >
          <form onSubmit={handleConnectKommo} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Subdomínio (ex: minhaloja)</label>
                <input type="text" required value={kommoSubdomain} onChange={e => setKommoSubdomain(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none" placeholder="minhaloja" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ID da Integração</label>
                <input type="text" required value={kommoIntegrationId} onChange={e => setKommoIntegrationId(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none" placeholder="Client ID" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Chave Secreta</label>
                <input type="password" required value={kommoSecretKey} onChange={e => setKommoSecretKey(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none" placeholder="Client Secret" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Código de Autorização</label>
                <input type="text" required value={kommoAuthCode} onChange={e => setKommoAuthCode(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none" placeholder="Code (válido por 20min)" />
              </div>
            </div>

            {kommoError && <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">{kommoError}</div>}

            <button type="submit" disabled={isConnectingKommo} className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              {isConnectingKommo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar ao Kommo'}
            </button>
            <p className="text-xs text-zinc-500 text-center">
              Crie a integração no Kommo em Configurações &gt; Integrações &gt; Criar Integração Privada. Use <strong>{typeof window !== 'undefined' ? window.location.origin : 'esta URL'}</strong> como Redirect URI.
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
