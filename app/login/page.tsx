'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Users, RefreshCw, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function LoginContent() {
  const router = useRouter();
  const supabase = createClient();
  
  const [showPassword, setShowPassword] = useState(false);
  
  // Default Agency Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Credenciais inválidas ou erro de conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[#09090b] text-zinc-50 relative">
      
      {/* Toast / Popup */}
      {error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border bg-red-950/90 border-red-900/50 text-red-50 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Left Column - Presentation */}
      <div className="relative flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 overflow-hidden hidden md:flex">
        {/* Radial Red Glow Background */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/3 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 relative flex items-center justify-center bg-zinc-100 rounded">
              <img src="/v4logo.png" alt="V4 Logo" className="w-8 h-8 object-contain" />
            </div>
            <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em]">
              — SISTEMA ADM V4
            </p>
          </div>
          
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6">
            Controle Total,<br />
            <span className="italic text-red-500">em tempo real.</span>
          </h1>
          
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed mb-12">
            Acompanhe todas as métricas de vendas, custo por lead e integrações de anúncios de todos os seus clientes em um único lugar.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-red-950/40 border border-red-900/50">
                <BarChart className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-zinc-300 font-medium text-lg">Leitura via Google Apps Script</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-red-950/40 border border-red-900/50">
                <Users className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-zinc-300 font-medium text-lg">Gestão Multi-Clientes Centralizada</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-red-950/40 border border-red-900/50">
                <RefreshCw className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-zinc-300 font-medium text-lg">Layout Escuro estilo Kommo CRM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="bg-[#0a0a0a] flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 relative border-l border-zinc-800/50 shadow-2xl z-10 w-full min-h-screen md:min-h-0">
        <div className="max-w-md w-full mx-auto">
          <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em] mb-4">
            — BEM-VINDO DE VOLTA
          </p>
          <h2 className="font-serif text-4xl font-bold text-white mb-10">
            Acesso Restrito
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">E-mail Operacional</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 px-4 bg-[#18181b] border border-[#27272a] text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:border-red-500 transition-colors"
                placeholder="contato@empresa.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Senha</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-4 pr-12 bg-[#18181b] border border-[#27272a] text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 mt-6 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Acessando...' : 'Entrar no Sistema'}
            </button>
          </form>

        </div>
      </div>
      
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
