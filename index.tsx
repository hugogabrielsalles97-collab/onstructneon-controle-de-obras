import { supabase } from './supabaseClient';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  if (urlStr.includes('generativelanguage.googleapis.com')) {
    const { data, error } = await supabase.rpc('gemini_proxy', {
      request_url: urlStr,
      request_body: init?.body ? JSON.parse(init.body as string) : {}
    });

    if (error) {
      console.error("Erro no Proxy Gemini:", error);
      throw new Error("Erro via Proxy do Banco: " + error.message);
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
