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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    if (signInError) {
      if (signInError.message.toLowerCase().includes('invalid api key') || signInError.message.toLowerCase().includes('failed to fetch')) {
        setError('Erro de Configuração: A chave de API (supabaseAnonKey) está incorreta. Verifique o arquivo supabaseClient.ts.');
      } else {
        setError(signInError.message === 'Invalid login credentials' ? 'Usuário ou senha inválidos.' : signInError.message);
      }
    } else {
      showToast('Login bem-sucedido!', 'success');
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
          <p className="text-center text-brand-med-gray font-bold uppercase tracking-[0.3em] text-[10px] mt-1">Gestão de Obras • V1.0</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="username"
                name="username"
                type="text" // Supabase uses email, but we'll stick to 'text' for user experience
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-t-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent focus:z-10 sm:text-sm"
                placeholder="Usuário (seu e-mail)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-brand-darkest bg-brand-darkest/50 placeholder-brand-med-gray text-gray-100 rounded-b-md focus:outline-none focus:ring-brand-accent focus:border-brand-accent focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-accent hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent focus:ring-offset-brand-dark transition-all duration-300 shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
        <p className="text-center text-sm text-brand-med-gray">
          Não tem uma conta?{' '}
          <button onClick={onNavigateToRegister} className="font-medium text-brand-accent hover:text-orange-400">
            Cadastre-se
          </button>
        </p>

      </div>
    </div>
  );
};

export default LoginScreen;