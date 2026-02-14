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
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, baselineTasks }) => {
  const { currentUser: user } = useData();
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

      const prompt = `
            Você é 'Hugo', um assistente de IA especialista em gestão de obras de construção civil.
            Responda de forma concisa para economizar tokens.
            
            **Legenda dos dados:**
            t: Título, s: Status, p: Progresso, resp: Responsável, start: Início Previsto, due: Fim Previsto, realStart: Início Real, realEnd: Fim Real.

            **Contexto do Projeto:**
            - Tarefas: ${JSON.stringify(tasksSummary)}
            - Planejamento (Baseline): ${JSON.stringify(baselineSummary)}
            - Hoje: ${new Date().toLocaleDateString('pt-BR')}

            **Exemplos de suas capacidades:**
            - **Resumir o projeto:** "Qual o status geral do projeto?", "Quais tarefas estão atrasadas?".
            - **Analisar dados:** "Quem é o responsável com mais tarefas em andamento?", "Compare o previsto com o realizado para a tarefa X".
            - **Fazer sugestões:** "Quais são os principais riscos para o cronograma agora?", "Sugira um plano de ação para a tarefa Y que está atrasada".
            - **Ajudar com o App:** "Como eu cadastro uma nova tarefa?", "Onde vejo os dashboards?".

            **Pergunta do usuário:**
            "${userInput}"

            Responda à pergunta do usuário com base no contexto fornecido.
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
        className={`fixed bottom-6 right-6 bg-brand-accent text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-brand-accent/40 hover:bg-orange-600 z-40 transform transition-all duration-300 ease-in-out ${isOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
          }`}
        aria-label="Abrir assistente de IA"
        disabled={isOpen}
      >
        <LightbulbIcon className="w-8 h-8" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[60vh] max-h-[600px] bg-brand-dark rounded-lg shadow-2xl shadow-brand-accent/20 border border-brand-accent/30 flex flex-col z-50 transform transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-brand-accent/20">
          <h3 className="text-lg font-bold text-brand-accent flex items-center gap-2">
            <LightbulbIcon className="w-6 h-6" />
            <span>Assistente Hugo com IA</span>
          </h3>
          <button onClick={toggleOpen} className="text-brand-med-gray hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs md:max-w-sm lg:max-w-md px-4 py-2 rounded-lg text-white ${msg.sender === 'user' ? 'bg-brand-accent' : 'bg-brand-darkest/70'
                  }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-sm lg:max-w-md px-4 py-2 rounded-lg bg-brand-darkest/70 text-brand-med-gray">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse delay-150"></div>
                  <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-brand-accent/20">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Pergunte sobre o projeto..."
              className="flex-1 bg-brand-darkest/50 border border-brand-darkest rounded-md py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="bg-brand-accent text-white rounded-md p-2.5 hover:bg-orange-600 disabled:bg-brand-med-gray/50 disabled:cursor-not-allowed transition-colors"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;