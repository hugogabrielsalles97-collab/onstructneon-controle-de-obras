import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const KEY = '@elos_theme';

const getInitial = (): Theme => {
    try {
        return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

let current: Theme = getInitial();
const listeners = new Set<() => void>();

const apply = (t: Theme) => {
    try {
        document.documentElement.setAttribute('data-theme', t);
    } catch {
        /* no-op (SSR / non-browser) */
    }
};

// Ensure the attribute reflects the persisted value as soon as this module loads.
apply(current);

export const getTheme = (): Theme => current;

export const setTheme = (t: Theme) => {
    if (t === current) return;
    current = t;
    try {
        localStorage.setItem(KEY, t);
    } catch {
        /* no-op */
    }
    apply(t);
    listeners.forEach((l) => l());
};

export const toggleTheme = () => setTheme(current === 'dark' ? 'light' : 'dark');

const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
};

/** React hook: re-renders the component whenever the global theme changes. */
export const useTheme = () => {
    const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
    return { theme, isLight: theme === 'light', setTheme, toggleTheme };
};
