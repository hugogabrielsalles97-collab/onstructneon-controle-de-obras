import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { useData } from '../context/DataProvider';
import { GoogleGenerativeAI } from "@google/generative-ai";
import XIcon from './icons/XIcon';
import SendIcon from './icons/SendIcon';
import LightbulbIcon from './icons/LightbulbIcon';

interface AIAssistantProps {
  tasks: Task[];
  baselineTasks: Task[];
  activeScreen?: string;
  costItems?: any[];
  measurements?: any[];
  cashFlow?: any[];
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, baselineTasks, activeScreen, costItems = [], measurements = [], cashFlow = [] }) => {
  const isCostModule = activeScreen === 'cost';
  const { currentUser: user, isDevToolsOpen, setIsDevToolsOpen } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canUseAI = user?.role === 'Master' || user?.role === 'Gerenciador';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ sender: 'ai', text: "Olá! Sou o Hugo, seu assistente de IA. Como posso ajudar com a gestão da sua obra hoje?" }]);
    }
  }, [isOpen, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    // Secret Command: Toggle TanStack Query DevTools
    if (userInput.toLowerCase().trim() === 'abrir tanstak' || userInput.toLowerCase().trim() === 'abrir tanstack') {
      const newState = !isDevToolsOpen;
      setIsDevToolsOpen(newState);
      setMessages([...messages, { sender: 'user', text: userInput }, { sender: 'ai', text: newState ? "✅ Modo Desenvolvedor ativado: Ferramentas TanStack abertas." : "🔒 Modo Desenvolvedor desativado." }]);
      setUserInput('');
      return;
    }

    if (!canUseAI) {
      alert("Upgrade necessário para enviar solicitações ao Assistente Hugo com IA.");
      return;
    }

    const newMessages: Message[] = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);

      // TOKEN OPTIMIZATION: Send only essential data to reduce costs
      const tasksSummary = tasks.map(t => {
        // Construct minimal object
        const s: any = {
          t: t.title,
          s: t.status,
          p: t.progress + '%',
          start: t.startDate,
          due: t.dueDate
        };
        // Only add optional fields if they exist
        if (t.assignee) s.resp = t.assignee;
        if (t.actualStartDate) s.realStart = t.actualStartDate;
        if (t.actualEndDate) s.realEnd = t.actualEndDate;
        return s;
      });

      const baselineSummary = baselineTasks.map(t => ({
        t: t.title,
        start: t.startDate,
        due: t.dueDate
      }));

      const prompt = isCostModule
        ? `
            Você é 'Hugo', um assistente de IA especialista em GESTÃO FINANCEIRA E CUSTOS de obras.
            Você está no Módulo de Custos da plataforma Lean Solution.
            Responda de forma concisa.

            **Contexto Financeiro:**
            - Orçamento vs Realizado: ${JSON.stringify(costItems)}
            - Medições Recentes: ${JSON.stringify(measurements)}
            - Fluxo de Caixa: ${JSON.stringify(cashFlow)}
            - Hoje: ${new Date().toLocaleDateString('pt-BR')}

            **Suas capacidades neste módulo:**
            - Analisar BUDGET vs ACTUAL (Onde estamos gastando mais?).
            - Resumir medições e andamento financeiro.
            - Sugerir ações para viabilidade econômica.
            - Explicar conceitos de fluxo de caixa e gestão de insumos.

            **Pergunta do usuário:**
            "${userInput}"
        `
        : `
            Você é 'Hugo', um assistente de IA especialista em GESTÃO DE OBRAS (Planejamento e Execução).
            Responda de forma concisa.
            
            **Legenda dos dados:**
            t: Título, s: Status, p: Progresso, resp: Responsável, start: Início Previsto, due: Fim Previsto, realStart: Início Real, realEnd: Fim Real.

            **Contexto do Projeto:**
            - Tarefas: ${JSON.stringify(tasksSummary)}
            - Planejamento (Baseline): ${JSON.stringify(baselineSummary)}
            - Hoje: ${new Date().toLocaleDateString('pt-BR')}

            **Pergunta do usuário:**
            "${userInput}"
        `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const output = await result.response.text();

      setMessages([...newMessages, { sender: 'ai', text: output }]);
    } catch (error) {
      console.error("Erro ao chamar a API Gemini:", error);
      setMessages([...newMessages, { sender: 'ai', text: "Erro: " + (error instanceof Error ? error.message : String(error)) }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>

      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        className={`fixed bottom-6 right-6 z-40 group transition-all duration-500 ease-in-out ${isOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        aria-label="Abrir assistente Hugo"
      >
        <div className={`absolute inset-0 ${isCostModule ? 'bg-green-600/40' : 'bg-brand-accent/40'} rounded-full blur-xl animate-pulse ${isCostModule ? 'group-hover:bg-green-600/60' : 'group-hover:bg-brand-accent/60'} transition-all duration-500`}></div>
        <div className={`relative bg-[#0a0f18] w-14 h-14 rounded-full flex items-center justify-center border ${isCostModule ? 'border-green-600/50 shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:border-green-500' : 'border-brand-accent/50 shadow-[0_0_20px_rgba(227,90,16,0.3)] hover:border-brand-accent'} transition-transform duration-300`}>
          <LightbulbIcon className={`w-6 h-6 ${isCostModule ? 'text-green-500 drop-shadow-[0_0_5px_rgba(22,163,74,0.8)]' : 'text-brand-accent drop-shadow-[0_0_5px_rgba(227,90,16,0.8)]'}`} />
        </div>
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[650px] max-h-[85vh] flex flex-col z-50 transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) origin-bottom-right ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'}`}
      >
        {/* Glass Container */}
        <div className="absolute inset-0 bg-[#0a0f18]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">

          {/* Header */}
          <div className={`relative px-6 py-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r ${isCostModule ? 'from-green-600/10' : 'from-brand-accent/10'} via-transparent to-transparent`}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="relative">
                <div className={`absolute inset-0 ${isCostModule ? 'bg-green-500' : 'brand-accent'} rounded-full blur-md opacity-20 animate-pulse`}></div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1f2937] to-[#111827] flex items-center justify-center border border-white/10 shadow-inner">
                  <LightbulbIcon className={`w-5 h-5 ${isCostModule ? 'text-green-500' : 'text-brand-accent'}`} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0a0f18] rounded-full"></div>
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight tracking-wide">Hugo AI</h3>
                <p className={`text-[10px] ${isCostModule ? 'text-green-500/80' : 'text-brand-accent/80'} font-mono tracking-wider uppercase flex items-center gap-1`}>
                  <span className={`w-1 h-1 ${isCostModule ? 'bg-green-500' : 'bg-brand-accent'} rounded-full animate-blink`}></span>
                  Engenheiro Virtual
                </p>
              </div>
            </div>
            <button
              onClick={toggleOpen}
              className="relative z-10 p-2 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-colors group"
            >
              <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-brand-accent/50 scrollbar-track-transparent">
            <div className="text-center my-2 opacity-50">
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">— Hoje —</span>
            </div>

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-[#1f2937] flex items-center justify-center mr-3 flex-shrink-0 border border-white/5 shadow-sm self-end mb-1">
                    <span className={`text-xs font-bold ${isCostModule ? 'text-green-500' : 'text-brand-accent'}`}>H</span>
                  </div>
                )}
                <div className={`max-w-[85%] p-4 text-sm shadow-lg backdrop-blur-sm ${msg.sender === 'user'
                  ? `bg-gradient-to-br ${isCostModule ? 'from-green-600 to-green-800' : 'from-brand-accent to-[#c2410c]'} text-white rounded-2xl rounded-tr-sm border ${isCostModule ? 'border-green-500/20' : 'border-orange-500/20'}`
                  : 'bg-[#1f2937]/80 border border-white/5 text-gray-200 rounded-2xl rounded-tl-sm'
                  }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-fade-in pl-11">
                <div className="bg-[#1f2937]/50 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center w-fit">
                  <div className={`w-1.5 h-1.5 ${isCostModule ? 'bg-green-500/60' : 'bg-brand-accent/60'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                  <div className={`w-1.5 h-1.5 ${isCostModule ? 'bg-green-500/60' : 'bg-brand-accent/60'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                  <div className={`w-1.5 h-1.5 ${isCostModule ? 'bg-green-500/60' : 'bg-brand-accent/60'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#05080f]/80 backdrop-blur-md border-t border-white/5 relative z-20">
            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Pergunte sobre sua obra..."
                className={`w-full bg-[#111827] text-white text-sm rounded-xl pl-5 pr-12 py-4 border border-white/5 ${isCostModule ? 'focus:border-green-500/50 focus:ring-green-500/50' : 'focus:border-brand-accent/50 focus:ring-brand-accent/50'} focus:outline-none transition-all placeholder-gray-600 shadow-inner font-light`}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className={`absolute right-2 p-2.5 ${isCostModule ? 'bg-green-600 shadow-green-600/20 hover:bg-green-500' : 'bg-brand-accent shadow-brand-accent/20 hover:bg-orange-600'} rounded-lg text-white shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200 group`}
              >
                <SendIcon className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </form>
            <p className="text-[10px] text-gray-600 text-center mt-3 font-mono">
              Hugo AI powered by Lean Solution
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;