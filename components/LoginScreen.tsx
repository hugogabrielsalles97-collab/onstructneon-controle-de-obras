import React, { useState } from 'react';
import ConstructionIcon from './icons/ConstructionIcon';
import { supabase } from '../supabaseClient';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onVisitorLogin: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister, onVisitorLogin, showToast }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    const loginEmail = username.includes('@') ? username : `${username}@construcao.com`;

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password,
    });

    if (signInError) {
      if (signInError.message.toLowerCase().includes('invalid api key') || signInError.message.toLowerCase().includes('failed to fetch')) {
        setError('Erro de Configuração: A chave de API (supabaseAnonKey) está incorreta. Verifique o arquivo supabaseClient.ts.');
      } else {
        setError(signInError.message === 'Invalid login credentials' ? 'Usuário ou senha inválidos.' : signInError.message);
      }
    } else if (signInData.user) {
      // Check if user is approved
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', signInData.user.id)
        .single();

      if (profileError) {
        setError('Erro ao verificar perfil. Tente novamente.');
        await supabase.auth.signOut();
      } else if (profile && !profile.is_approved) {
        setError('Sua conta ainda não foi aprovada por um usuário Master. Por favor, aguarde a aprovação.');
        await supabase.auth.signOut();
      } else {
        showToast('Login bem-sucedido!', 'success');
      }
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020202] overflow-hidden font-sans selection:bg-brand-accent selection:text-white">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a1f2e] via-[#050505] to-[#000000] z-0"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-accent/10 rounded-full blur-[120px] animate-pulse pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[420px] p-6 animate-slide-up">
        {/* Glass Card */}
        <div className="bg-[#111827]/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] relative overflow-hidden group hover:border-brand-accent/20 transition-all duration-500">

          {/* Top Line Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-accent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>

          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-6 group-hover:scale-110 transition-transform duration-500">
              <div className="absolute inset-0 bg-brand-accent/20 blur-xl rounded-full"></div>
              <ConstructionIcon className="relative w-16 h-16 text-brand-accent drop-shadow-[0_0_15px_rgba(227,90,16,0.5)]" />
            </div>
            <h1 className="text-4xl font-black text-center text-white tracking-tighter uppercase italic">
              Lean <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-orange-400">Solution</span>
            </h1>
            <p className="text-center text-brand-med-gray font-bold uppercase tracking-[0.3em] text-[10px] mt-2 opacity-80">
              Sistema de Gestão de Obras
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray group-focus-within/input:text-brand-accent transition-colors block">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full bg-[#0a0f18]/60 border border-white/5 text-white text-sm rounded-xl px-12 py-3.5 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 placeholder-gray-600 transition-all shadow-inner"
                  placeholder="Seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray group-focus-within/input:text-brand-accent transition-colors block">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="w-full bg-[#0a0f18]/60 border border-white/5 text-white text-sm rounded-xl px-12 py-3.5 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 placeholder-gray-600 transition-all shadow-inner"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center p-3 rounded-lg animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-brand-accent to-orange-600 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent focus:ring-offset-[#111827] transition-all duration-300 shadow-[0_0_20px_-5px_rgba(227,90,16,0.4)] hover:shadow-[0_0_30px_-5px_rgba(227,90,16,0.6)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Acessando...
                </>
              ) : (
                'Entrar na Plataforma'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-start text-gray-500 mb-2 font-semibold">Novo por aqui?</p>
            <button
              onClick={onNavigateToRegister}
              className="w-full py-3 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-300 flex justify-between items-center px-4 group/btn"
            >
              <span>Criar nova conta</span>
              <span className="text-brand-accent opacity-0 group-hover/btn:opacity-100 transition-opacity">→</span>
            </button>
          </div>

        </div>

        <p className="text-center text-[10px] text-gray-600 mt-6 font-mono opacity-50">
          &copy; 2026 Lean Solution.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;