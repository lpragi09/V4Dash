'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navLinks = [
    { name: 'Visão Geral', href: '/dashboard' },
    { name: 'Meta Ads', href: '/dashboard/meta-ads' },
    { name: 'Google Ads', href: '/dashboard/google-ads' },
    { name: 'CRM', href: '/dashboard/crm' },
    { name: 'Configurações', href: '/dashboard/settings' },
  ];

  return (
    <header className="relative z-20 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href="/dashboard" className="font-serif font-bold text-2xl tracking-tight text-white flex items-center gap-3">
            <div className="w-10 h-10 relative flex items-center justify-center">
              <Image src="/v4logo.png" alt="V4 Company Logo" fill className="object-contain" priority />
            </div>
            Dash-V4
          </Link>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`font-medium text-sm transition-colors ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 hidden sm:block">
            {userEmail || 'Carregando...'}
          </span>
          <button 
            onClick={handleLogout}
            className="p-2 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-colors border border-transparent hover:border-[#27272a]"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
