import React, { useState, useEffect } from 'react';
import ConstructionIcon from './icons/ConstructionIcon';
import { supabase } from '../supabaseClient';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const TOKENS: Record<'Planejador' | 'Executor', string> = {
  'Planejador': 'admin',
  'Executor': 'producao',
};

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin, showToast }) => {
  const [role, setRole] = useState<'Planejador' | 'Executor'>('Executor');
  const [token, setToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [username, setUsername] = useState(''); // This will be used as email
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      // The trigger in Supabase will now handle profile creation automatically.
      setSuccess('Usuário cadastrado com sucesso! Verifique seu e-mail para confirmar a conta e depois faça o login.');
      showToast('Cadastro realizado! Verifique seu e-mail.', 'success');
      setTimeout(() => {
        onNavigateToLogin();
      }, 4000);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-darkest">
      <div className="w-full max-w-md p-8 space-y-6 bg-brand-dark rounded-lg shadow-2xl shadow-brand-accent/20 border border-brand-accent/30">
        <div className="flex flex-col items-center">
          <ConstructionIcon className="w-16 h-16 text-brand-accent drop-shadow-[0_0_15px_rgba(227,90,16,0.3)]" />
          <h1 className="text-3xl font-black text-center text-white mt-4 tracking-tighter uppercase italic">
            Lean <span className="text-brand-accent">Solution</span>
          </h1>
          <p className="text-center text-brand-med-gray font-bold uppercase tracking-[0.3em] text-[10px] mt-1">Crie sua conta • V1.0</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleRegister}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-brand-med-gray mb-1">Tipo de Usuário</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'Planejador' | 'Executor')}
                className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
              >
                <option value="Executor">Executor</option>
                <option value="Planejador">Planejador</option>
              </select>
            </div>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-brand-med-gray mb-1">Token de Acesso</label>
              <input
                id="token"
                type="text"
                required
                className={`appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm ${tokenError ? 'border-red-500 ring-red-500' : ''}`}
                placeholder="Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {tokenError && <p className="col-span-2 text-red-400 text-xs -mt-3 text-right">{tokenError}</p>}
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-brand-med-gray mb-1">Nome Completo</label>
            <input
              id="fullName"
              type="text"
              required
              className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
              placeholder="Seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-brand-med-gray mb-1">Nº de WhatsApp</label>
            <input
              id="whatsapp"
              type="tel"
              required
              className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
              placeholder="(XX) XXXXX-XXXX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <hr className="border-brand-dark/50" />
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-brand-med-gray mb-1">E-mail (Login)</label>
            <input
              id="username"
              type="email"
              required
              className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
              placeholder="seu-email@dominio.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-med-gray mb-1">Senha</label>
              <input
                id="password"
                type="password"
                required
                className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
                placeholder="Crie uma senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-brand-med-gray mb-1">Confirmar Senha</label>
              <input
                id="confirm-password"
                type="password"
                required
                className="appearance-none block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {success && <p className="text-green-400 text-sm text-center">{success}</p>}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-accent hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent focus:ring-offset-brand-dark transition-all duration-300 shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 disabled:opacity-50"
              disabled={!!tokenError || !!success || loading}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
        <p className="text-center text-sm text-brand-med-gray">
          Já tem uma conta?{' '}
          <button onClick={onNavigateToLogin} className="font-medium text-brand-accent hover:text-orange-400">
            Faça login
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterScreen;