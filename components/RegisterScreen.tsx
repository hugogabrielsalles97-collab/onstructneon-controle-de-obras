import React, { useState, useEffect } from 'react';
import ConstructionIcon from './icons/ConstructionIcon';
import { supabase } from '../supabaseClient';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const TOKENS: Record<'Master' | 'Planejador' | 'Gerenciador' | 'Executor', string> = {
  'Master': 'admin',
  'Planejador': 'planning',
  'Gerenciador': 'manager',
  'Executor': 'production',
};

const ROLE_INFO: Record<'Master' | 'Planejador' | 'Gerenciador' | 'Executor', { desc: string; highlights: string[] }> = {
  'Master': {
    desc: 'Controle total da obra e do sistema.',
    highlights: ['Planejamento e Execução', 'Linha Base e Relatórios', 'IA Assistant e IA Insights']
  },
  'Planejador': {
    desc: 'Gestão estratégica e cronograma.',
    highlights: ['Edição de Planejamento', 'Gestão de Linha Base', 'Análise de Restrições']
  },
  'Gerenciador': {
    desc: 'Monitoramento e Análise Inteligente.',
    highlights: ['IA Assistant de Elite', 'Visualização de Relatórios', 'Acesso Full Read-only']
  },
  'Executor': {
    desc: 'Foco operacional e campo.',
    highlights: ['Lançamento de Produção', 'Visualização de Tarefas']
  }
};

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin, showToast }) => {
  const [role, setRole] = useState<'Master' | 'Planejador' | 'Gerenciador' | 'Executor'>('Executor');
  const [token, setToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [username, setUsername] = useState(''); // This will be used as email
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      if (TOKENS[role] === token) {
        setTokenError('');
      } else {
        setTokenError('Token inválido para o perfil selecionado.');
      }
    } else {
      setTokenError('');
    }
  }, [token, role]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!username || !password || !confirmPassword || !fullName || !whatsapp || !token) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    if (tokenError) {
      setError('Por favor, corrija o token antes de continuar.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    // Supabase sign up
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: username,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          whatsapp: whatsapp
        }
      }
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('invalid api key') || signUpError.message.toLowerCase().includes('failed to fetch')) {
        setError('Erro de Configuração: A chave de API (supabaseAnonKey) está incorreta. Verifique o arquivo supabaseClient.ts.');
      } else {
        setError(signUpError.message === 'User already registered' ? 'Este e-mail já está cadastrado.' : signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (user) {
      setSuccess('Usuário cadastrado com sucesso! Você já pode realizar o seu login.');
      showToast('Cadastro realizado com sucesso!', 'success');
      setTimeout(() => {
        onNavigateToLogin();
      }, 2500);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020202] py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-brand-accent selection:text-white overflow-hidden">

      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-[#1a1f2e] via-[#050505] to-[#000000] z-0"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-brand-accent/5 rounded-full blur-[150px] animate-pulse pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none"></div>


      <div className="relative z-10 w-full max-w-4xl animate-slide-up">
        <div className="bg-[#111827]/40 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] flex flex-col md:flex-row">

          {/* Left Side: Info & Branding */}
          <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-[#0a0f18] to-[#111827] p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-transparent"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <ConstructionIcon className="w-10 h-10 text-brand-accent" />
                <span className="text-xl font-black text-white italic tracking-tighter">LEAN SOLUTION</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 leading-tight">Construa o futuro <br /><span className="text-brand-accent">com inteligência.</span></h2>
              <p className="text-brand-med-gray text-sm leading-relaxed">
                Sistema completo para gestão de obras, integrando planejamento, execução e controle em uma plataforma unificada.
              </p>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-brand-accent/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-brand-accent font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
                    Plano Selecionado
                  </h3>
                  <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded font-bold uppercase">{role}</span>
                </div>
                <p className="text-white font-medium text-sm mb-3">{ROLE_INFO[role].desc}</p>
                <ul className="space-y-1.5">
                  {ROLE_INFO[role].highlights.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                &copy; 2026 Lean Solution.
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="w-full md:w-7/12 p-8 md:p-12 bg-[#0a0f18]/60 relative">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Criar Conta</h2>
              <button onClick={onNavigateToLogin} className="text-sm text-brand-accent font-bold hover:text-white transition-colors">
                Já tenho conta
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleRegister}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Role Selection */}
                <div className="md:col-span-1 group/input">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-start">Perfil</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="appearance-none w-full bg-[#111827] border border-white/10 text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all cursor-pointer hover:bg-white/5"
                    >
                      {Object.keys(TOKENS).map(r => (
                        <option key={r} value={r} className="bg-[#111827] text-white">{r}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  </div>
                </div>

                {/* Token Input */}
                <div className="md:col-span-1 group/input">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-start">Chave de Acesso</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                    </div>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className={`w-full bg-[#111827] border ${tokenError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-white/10 border-white/5'} text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600`}
                      placeholder="Token da empresa"
                      required
                    />
                  </div>
                  {tokenError && <p className="text-red-400 text-[10px] mt-1 text-right">{tokenError}</p>}
                </div>

                {/* Full Name */}
                <div className="md:col-span-2">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></svg>
                    </div>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#111827] border border-white/10 text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600"
                      placeholder="Nome Completo"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="md:col-span-1">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </div>
                    <input
                      type="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#111827] border border-white/10 text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600"
                      placeholder="E-mail (Login)"
                      required
                    />
                  </div>
                </div>

                {/* Whatsapp */}
                <div className="md:col-span-1">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-[#111827] border border-white/10 text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600"
                      placeholder="WhatsApp (XX) XXXXX-XXXX"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="md:col-span-1">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#111827] border border-white/10 text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600"
                      placeholder="Senha"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="md:col-span-1">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-med-gray">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-[#111827] border ${password && confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-white/10'} text-white text-sm rounded-xl px-10 py-3 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all placeholder-gray-600`}
                      placeholder="Confirmar Senha"
                      required
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {showPassword ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        Ocultar Senha
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Mostrar Senha
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center p-3 rounded-lg animate-shake md:col-span-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs text-center p-3 rounded-lg animate-fade-in md:col-span-2">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="group w-full py-4 bg-gradient-to-r from-brand-accent to-orange-600 rounded-xl font-bold text-white shadow-[0_4px_20px_-5px_rgba(227,90,16,0.4)] hover:shadow-[0_8px_30px_-5px_rgba(227,90,16,0.6)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mt-4"
                disabled={!!tokenError || !!success || loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <span>Completar Cadastro</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;