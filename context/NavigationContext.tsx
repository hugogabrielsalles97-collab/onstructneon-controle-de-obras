import { createContext, useContext } from 'react';

/**
 * Navegação global disponível em qualquer tela, independente de a página
 * repassar callbacks por props. Usado pelo Sidebar/Header para itens que
 * devem aparecer sempre (ex.: Linha de Balanço).
 */
export interface NavigationContextType {
    navigateToLineOfBalance?: () => void;
}

export const NavigationContext = createContext<NavigationContextType>({});

export const useNavigation = () => useContext(NavigationContext);
