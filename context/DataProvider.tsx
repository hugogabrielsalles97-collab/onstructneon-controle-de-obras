import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { User, Task } from '../types';

interface DataContextType {
    session: Session | null;
    currentUser: User | null;
    allUsers: User[];
    tasks: Task[];
    baselineTasks: Task[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
    saveTask: (task: Task) => Promise<{ success: boolean; error?: string }>;
    deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    importBaseline: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>;
    cutOffDateStr: string;
    setCutOffDateStr: (date: string) => void;
    loginAsVisitor: () => void;
    signOut: () => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [baselineTasks, setBaselineTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cutOffDateStr, setCutOffDateStr] = useState('2026-01-10');

    const fetchProfileAndTasks = useCallback(async (currentSession: Session) => {
        setIsLoading(true);

        // Função auxiliar para buscar TODOS os registros (bypass do limite de 1000 do Supabase)
        const fetchAllRows = async (tableName: string) => {
            let allRows: any[] = [];
            let errorOccurred = false;
            let from = 0;
            const step = 1000;

            while (true) {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .range(from, from + step - 1);

                if (error) {
                    console.error(`Error fetching ${tableName}:`, error);
                    errorOccurred = true;
                    break;
                }

                if (data && data.length > 0) {
                    allRows = [...allRows, ...data];
                    if (data.length < step) break; // Chegou ao fim
                    from += step;
                } else {
                    break;
                }
            }
            return { data: allRows, error: errorOccurred };
        };

        try {
            // Fetch user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select(`id, username, role, fullName: full_name, whatsapp`)
                .eq('id', currentSession.user.id)
                .single();

            if (profileError) console.error("Error fetching profile:", profileError);
            if (profile) setCurrentUser(profile);

            // Fetch all users
            const { data: allProfiles, error: allProfilesError } = await supabase
                .from('profiles')
                .select(`id, username, role, fullName: full_name, whatsapp`);

            if (allProfilesError) console.error("Error fetching users:", allProfilesError);
            setAllUsers(allProfiles || []);

            // Fetch tasks (All rows)
            const tasksResult = await fetchAllRows('tasks');
            setTasks(tasksResult.data || []);

            // Fetch baseline (All rows)
            const baselineResult = await fetchAllRows('baseline_tasks');
            setBaselineTasks(baselineResult.data || []);

        } catch (error: any) {
            console.error('Erro ao carregar dados:', error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                setSession(session);
                if (session) {
                    fetchProfileAndTasks(session);
                } else {
                    setIsLoading(false);
                }
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                if (session) {
                    fetchProfileAndTasks(session);
                } else {
                    setCurrentUser(null);
                    setTasks([]);
                    setBaselineTasks([]);
                    setAllUsers([]);
                    setIsLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfileAndTasks]);

    const refreshData = async () => {
        if (session) {
            await fetchProfileAndTasks(session);
        }
    };

    const saveTask = async (task: Task) => {
        if (!session) return { success: false, error: 'No session' };

        const existingTask = tasks.find(t => t.id === task.id);

        try {
            let result;
            if (existingTask) {
                // Update
                const { id, ...taskUpdates } = task;
                const { data, error } = await supabase.from('tasks').update({ ...taskUpdates, user_id: session.user.id }).eq('id', id).select();
                if (error) throw error;
                result = data?.[0];
                if (result) {
                    setTasks(prev => prev.map(t => t.id === id ? result : t));
                }
            } else {
                // Insert
                const { id, ...taskData } = task;
                const { data, error } = await supabase.from('tasks').insert([{ ...taskData, user_id: session.user.id }]).select();
                if (error) throw error;
                result = data?.[0];
                if (result) {
                    setTasks(prev => [...prev, result]);
                }
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteTask = async (taskId: string) => {
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            setTasks(prev => prev.filter(t => t.id !== taskId));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const importBaseline = async (newTasks: Task[]) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { error: deleteError } = await supabase.from('baseline_tasks').delete().eq('user_id', session.user.id);
            if (deleteError) throw deleteError;

            const tasksToInsert = newTasks.map(t => ({ ...t, user_id: session.user.id }));
            const { data, error: insertError } = await supabase.from('baseline_tasks').insert(tasksToInsert).select();
            if (insertError) throw insertError;

            setBaselineTasks(data || []);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const loginAsVisitor = () => {
        const visitorUser: User = { id: 'visitor', username: 'Visitante', role: 'Visitante' };
        setCurrentUser(visitorUser);
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: error.message };
        return { success: true };
    };

    return (
        <DataContext.Provider value={{
            session, currentUser, allUsers, tasks, baselineTasks, isLoading, refreshData,
            saveTask, deleteTask, importBaseline, cutOffDateStr, setCutOffDateStr,
            loginAsVisitor, signOut
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
