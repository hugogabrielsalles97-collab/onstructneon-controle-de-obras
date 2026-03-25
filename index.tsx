import { supabase } from './supabaseClient';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  
  if (urlStr.includes('generativelanguage.googleapis.com')) {
    // Garante a inserção da chave limpa sem quebra de linhas Windows (/r/n)
    const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY?.trim() || '';
    if (!urlStr.includes('key=') && apiKey) {
        urlStr += (urlStr.includes('?') ? '&' : '?') + 'key=' + apiKey;
    }

    const { data, error } = await supabase.rpc('gemini_proxy', {
      request_url: urlStr,
      request_body: init?.body ? JSON.parse(init.body as string) : {}
    });

    if (error) {
      console.error("Erro no Protocolo Proxy Gemini:", error);
      throw new Error("Falha no Banco: " + error.message);
    }
    
    if (data?.error) {
        console.error("Google Gemini Recusou o pacote:", data.error);
        throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return originalFetch(input, init);
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Good for performance, avoids unnecessary refetches
      retry: 1, // Only retry once on failure
    },
  },
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
