'use client';

import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Activity, 
  Search, 
  MessageSquare,
  Settings,
  Users,
  LogOut,
  Calendar
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Client {
  id: string;
  nome: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const clientId = params.clientId as string | undefined;

  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clientes').select('id, nome').order('nome');
      if (data) {
        setClients(data);
      }
    };
    fetchClients();
  }, []);

  const navItems = [
    { name: 'Acomp. Mensal', href: clientId ? `/dashboard/${clientId}` : '/dashboard', icon: LayoutDashboard },
    { name: 'Acomp. Semanal', href: clientId ? `/dashboard/${clientId}/semanal` : '/dashboard/semanal', icon: Calendar },
    { name: 'bd Meta Ads', href: clientId ? `/dashboard/${clientId}/meta-ads` : '/dashboard/meta-ads', icon: Activity },
    { name: 'bd Google Ads', href: clientId ? `/dashboard/${clientId}/google-ads` : '/dashboard/google-ads', icon: Search },
  ];

  return (
    <aside className="w-[280px] h-screen bg-[#0a0a0a] border-r border-zinc-800/50 flex flex-col flex-shrink-0 relative z-20">
      
      {/* Logo & Client Selector */}
      <div className="p-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 relative flex items-center justify-center bg-white rounded">
            <img src="/v4logo.png" alt="V4 Logo" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-serif font-bold text-xl text-white tracking-tight">Dash-V4</span>
        </div>

        {/* Client Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Cliente Ativo</label>
          <div className="relative">
            <select 
              className="w-full appearance-none bg-[#18181b] border border-[#27272a] text-white text-sm rounded-lg px-4 py-3 pr-10 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 cursor-pointer"
              value={clientId || ''}
              onChange={(e) => {
                const newClient = e.target.value;
                if (newClient) {
                  window.location.href = `/dashboard/${newClient}`;
                } else {
                  window.location.href = `/dashboard`;
                }
              }}
            >
              <option value="" disabled>Selecione um cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-zinc-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-red-500/10 text-red-500' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              } ${!clientId && item.name !== 'Visão Geral' && item.name !== 'Gerenciar Clientes' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Settings */}
      <div className="p-4 border-t border-zinc-800/50">
        <Link 
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
            pathname === '/dashboard/settings' 
              ? 'bg-zinc-800 text-white' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300" />
          <span className="font-medium text-sm">Configurações Gerais</span>
        </Link>
      </div>
      
    </aside>
  );
}
