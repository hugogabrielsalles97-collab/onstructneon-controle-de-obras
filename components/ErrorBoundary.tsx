import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Algo deu errado 😕</h1>
                    <p className="mb-4 text-center max-w-lg">
                        Desculpe, encontramos um erro inesperado. Tente recarregar a página.
                    </p>
                    {this.state.error && (
                        <div className="bg-gray-800 p-4 rounded border border-red-900 overflow-auto max-w-3xl w-full">
                            <p className="text-red-300 font-mono text-sm whitespace-pre-wrap">
                                {this.state.error.toString()}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
                    >
                        Recarregar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
