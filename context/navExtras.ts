import { createContext } from 'react';

/**
 * Navegações extras disponíveis para o Sidebar em qualquer tela, sem precisar
 * encadear a prop por todas as páginas. O App provê; o Sidebar consome com fallback.
 */
export interface NavExtras {
    onNavigateToVisualPavimento?: () => void;
}

export const NavExtrasContext = createContext<NavExtras>({});
