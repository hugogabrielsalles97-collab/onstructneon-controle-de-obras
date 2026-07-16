import React, { useCallback } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import Sidebar from './Sidebar';

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
                <div className="flex-1" />
            </main>
        </div>
    );
};

export default VisualPavimentoPage;