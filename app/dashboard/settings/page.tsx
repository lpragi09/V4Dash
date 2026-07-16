'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Trash2, Edit2, Loader2, Save, X, Building, LogOut, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  nome: string;
  meta_ads_account_id?: string;
}

export default function SettingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editMetaId, setEditMetaId] = useState('');

  const supabase = createClient();
  const router = useRouter();

  // Add Form states
  const [nome, setNome] = useState('');
  const [metaId, setMetaId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    // Busca clientes e suas integrações do Meta Ads
    const { data: clientsData, error: clientsError } = await supabase
      .from('clientes')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (clientsData) {
      const { data: integrations } = await supabase
        .from('integracoes_clientes')
        .select('*')
        .eq('plataforma', 'meta_ads');

      const mergedClients = clientsData.map(client => {
        const metaInt = integrations?.find(i => i.cliente_id === client.id);
        return {
          ...client,
          meta_ads_account_id: metaInt?.conta_id || ''
        };
      });
      setClients(mergedClients);
    }
    setIsLoading(false);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 1. Cria o cliente
    const { data: newClient, error: clientError } = await supabase
      .from('clientes')
      .insert([{ nome }])
      .select()
      .single();

    if (newClient && !clientError) {
      // 2. Se informou o ID do Meta Ads, cria a integração
      if (metaId) {
        await supabase
          .from('integracoes_clientes')
          .insert([{
            cliente_id: newClient.id,
            plataforma: 'meta_ads',
            conta_id: metaId
          }]);
      }

      setNome('');
      setMetaId('');
      setIsAdding(false);
      fetchClients();
      router.refresh(); 
    }
    
    setIsSubmitting(false);
  };

  const handleUpdateClient = async (id: string) => {
    setIsSubmitting(true);
    
    // Atualiza nome do cliente
    await supabase
      .from('clientes')
      .update({ nome: editNome })
      .eq('id', id);

    // Atualiza ou insere integração do Meta Ads
    if (editMetaId) {
      const { data: existingInt } = await supabase
        .from('integracoes_clientes')
        .select('id')
        .eq('cliente_id', id)
        .eq('plataforma', 'meta_ads')
        .single();

      if (existingInt) {
        await supabase
          .from('integracoes_clientes')
          .update({ conta_id: editMetaId })
          .eq('id', existingInt.id);
      } else {
        await supabase
          .from('integracoes_clientes')
          .insert([{
            cliente_id: id,
            plataforma: 'meta_ads',
            conta_id: editMetaId
          }]);
      }
    } else {
      // Se limpou o campo, remove a integração
      await supabase
        .from('integracoes_clientes')
        .delete()
        .eq('cliente_id', id)
        .eq('plataforma', 'meta_ads');
    }

    setEditingId(null);
    fetchClients();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este cliente? Todos os dados serão perdidos.')) {
      // Como o banco tem ON DELETE CASCADE, as integrações serão deletadas automaticamente
      await supabase.from('clientes').delete().eq('id', id);
      fetchClients();
      router.refresh();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-white mb-2">Configurações Gerais</h1>
        <p className="text-zinc-400">Gerencie a sua agência, preferências e todos os seus clientes conectados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Fake Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4 text-white">
              <Building className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-lg">Perfil da Agência</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-semibold uppercase">Nome da Agência</label>
                <input type="text" disabled value="V4 Company" className="w-full mt-1 bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2 text-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-semibold uppercase">E-mail Administrativo</label>
                <input type="email" disabled value="admin@dashv4.com" className="w-full mt-1 bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2 text-zinc-500" />
              </div>
            </div>
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

        {/* Right Column: Client Management */}
        <div className="lg:col-span-2">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-bold text-xl text-white">Gestão de Clientes</h2>
                <p className="text-sm text-zinc-400">Gerencie as contas de anúncios de cada cliente.</p>
              </div>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Adicionar Cliente</>}
              </button>
            </div>

            {isAdding && (
              <form onSubmit={handleAddClient} className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 mb-6 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Nome do Cliente</label>
                    <input 
                      type="text" 
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">ID da Conta Meta Ads</label>
                    <input 
                      type="text" 
                      value={metaId}
                      onChange={(e) => setMetaId(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
                      placeholder="ex: act_123456789"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2"
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
              <div className="space-y-3">
                {clients.map(client => (
                  <div key={client.id} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 transition-colors hover:border-zinc-700">
                    {editingId === client.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            placeholder="Nome do cliente"
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                          />
                          <input 
                            type="text" 
                            value={editMetaId}
                            onChange={(e) => setEditMetaId(e.target.value)}
                            placeholder="ID da Conta Meta Ads (act_...)"
                            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="p-2 text-zinc-400 hover:text-white rounded-lg">
                            <X className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleUpdateClient(client.id)}
                            disabled={isSubmitting}
                            className="p-2 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 rounded-lg"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{client.nome}</h3>
                          {client.meta_ads_account_id ? (
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <Activity className="w-3 h-3 text-blue-500" />
                              <span>Meta Ads: <span className="text-zinc-300">{client.meta_ads_account_id}</span></span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-500/70">Nenhuma conta Meta Ads vinculada</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingId(client.id);
                              setEditNome(client.nome);
                              setEditMetaId(client.meta_ads_account_id || '');
                            }}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(client.id)}
                            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
