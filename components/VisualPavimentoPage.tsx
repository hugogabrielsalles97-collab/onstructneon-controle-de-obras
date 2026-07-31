import React, { useCallback, Suspense } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import Sidebar from './Sidebar';

// O Viewer da Autodesk é pesado e só interessa nesta tela — fora do bundle inicial.
const ModelViewer = React.lazy(() => import('./ModelViewer'));

const VisualPavimentoPage: React.FC<any> = (props) => {
    const { currentUser: user, signOut } = useData();

    const handleLogout = useCallback(async () => {
        const { success, error } = await signOut();
        if (!success && error) props.showToast?.(`Erro ao sair: ${error}`, 'error');
    }, [signOut, props]);

    return (
        <div className="flex h-screen bg-brand-darkest text-gray-100 overflow-hidden">
            <Sidebar {...props} user={user} activeScreen="visualPavimento" />
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    {...props}
                    user={user}
                    onLogout={handleLogout}
                    activeScreen="visualPavimento"
                />
                <div className="flex-1 min-h-0">
                    <Suspense
                        fallback={
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="h-8 w-8 rounded-full border-2 border-gray-600 border-t-cyan-400 animate-spin" />
                            </div>
                        }
                    >
                        <ModelViewer />
                    </Suspense>
                </div>
            </main>
        </div>
    );
};

export default VisualPavimentoPage;