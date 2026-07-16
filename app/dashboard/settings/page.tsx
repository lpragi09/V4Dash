'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Trash2, Edit2, Loader2, Save, X, Building, LogOut, Activity, Search, MessageSquare, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  nome: string;
  meta_ads_account_id?: string;
  google_ads_account_id?: string;
  crm_account_id?: string;
}

export default function SettingsPage() {
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
  const [crmId, setCrmId] = useState('');
  const [isSavingConnections, setIsSavingConnections] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchClients();
  }, []);

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
          google_ads_account_id: googleInt?.conta_id || '',
          crm_account_id: crmInt?.conta_id || ''
        };
      });
      setClients(mergedClients);

      if (preserveSelection && selectedClientId) {
        const updatedSelected = mergedClients.find(c => c.id === selectedClientId);
        if (updatedSelected) {
          setMetaId(updatedSelected.meta_ads_account_id || '');
          setGoogleId(updatedSelected.google_ads_account_id || '');
          setCrmId(updatedSelected.crm_account_id || '');
        }
      }
    }
    setIsLoading(false);
  };

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
      handleSelectClient(newClient.id); // Auto-select to add connections
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

  const handleSelectClient = (id: string) => {
    const client = clients.find(c => c.id === id);
    if (client) {
      setSelectedClientId(id);
      setMetaId(client.meta_ads_account_id || '');
      setGoogleId(client.google_ads_account_id || '');
      setCrmId(client.crm_account_id || '');
    }
  };

  const handleSaveConnections = async () => {
    if (!selectedClientId) return;
    setIsSavingConnections(true);

    const syncIntegration = async (plataforma: string, contaId: string) => {
      if (contaId.trim()) {
        const { data: existingInt } = await supabase
          .from('integracoes_clientes')
          .select('id')
          .eq('cliente_id', selectedClientId)
          .eq('plataforma', plataforma)
          .single();

        if (existingInt) {
          await supabase.from('integracoes_clientes').update({ conta_id: contaId.trim() }).eq('id', existingInt.id);
        } else {
          await supabase.from('integracoes_clientes').insert([{ cliente_id: selectedClientId, plataforma, conta_id: contaId.trim() }]);
        }
      } else {
        await supabase.from('integracoes_clientes').delete().eq('cliente_id', selectedClientId).eq('plataforma', plataforma);
      }
    };

    await syncIntegration('meta_ads', metaId);
    await syncIntegration('google_ads', googleId);
    await syncIntegration('crm', crmId);

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
                            <span className={`w-2 h-2 rounded-full ${client.meta_ads_account_id ? 'bg-blue-500' : 'bg-zinc-800'}`} title="Meta Ads" />
                            <span className={`w-2 h-2 rounded-full ${client.google_ads_account_id ? 'bg-emerald-500' : 'bg-zinc-800'}`} title="Google Ads" />
                            <span className={`w-2 h-2 rounded-full ${client.crm_account_id ? 'bg-orange-500' : 'bg-zinc-800'}`} title="CRM" />
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
                  Configure os IDs das contas para o cliente <strong className="text-white">{selectedClient.nome}</strong>.
                </p>
              </div>

              <div className="space-y-6">
                {/* Meta Ads Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors focus-within:border-blue-500/50">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Meta Ads</h3>
                      <p className="text-xs text-zinc-500">ID da Conta de Anúncios</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={metaId}
                      onChange={(e) => setMetaId(e.target.value)}
                      placeholder="ex: act_123456789"
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Google Ads Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors focus-within:border-emerald-500/50">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Search className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Google Ads</h3>
                      <p className="text-xs text-zinc-500">ID da Conta (10 dígitos)</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={googleId}
                      onChange={(e) => setGoogleId(e.target.value)}
                      placeholder="ex: 123-456-7890"
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* CRM Connection */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-start transition-colors focus-within:border-orange-500/50">
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Kommo CRM</h3>
                      <p className="text-xs text-zinc-500">ID ou Pipeline Associado</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={crmId}
                      onChange={(e) => setCrmId(e.target.value)}
                      placeholder="ex: 123456"
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleSaveConnections}
                  disabled={isSavingConnections}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  {isSavingConnections ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Conexões
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-[#27272a] rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-[#18181b]/50">
              <div className="w-16 h-16 bg-[#27272a] rounded-2xl flex items-center justify-center mb-4">
                <Building className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Selecione um Cliente</h3>
              <p className="text-zinc-400 max-w-sm">
                Escolha um cliente na lista ao lado para gerenciar suas contas de Meta Ads, Google Ads e CRM.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
