import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { User, Task, Restriction } from '../types';

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
    restrictions: Restriction[];
    saveRestriction: (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => Promise<{ success: boolean; error?: string }>;
    updateRestriction: (id: string, updates: Partial<Restriction>) => Promise<{ success: boolean; error?: string }>;
    deleteRestriction: (id: string) => Promise<{ success: boolean; error?: string }>;
    cutOffDateStr: string;
    setCutOffDateStr: (date: string) => void;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    upgradeRole: (newRole: User['role']) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [baselineTasks, setBaselineTasks] = useState<Task[]>([]);
    const [restrictions, setRestrictions] = useState<Restriction[]>([]);
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
            if (profile) {
                // Check if this is the master user and update role if necessary
                if (profile.username === 'hugo.sales@egtc.com.br' && profile.role !== 'Master') {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ role: 'Master' })
                        .eq('id', profile.id);

                    if (!updateError) {
                        profile.role = 'Master';
                    }
                }
                setCurrentUser(profile);
            }

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

            // Fetch restrictions (All rows)
            const restrictionsResult = await fetchAllRows('restrictions');
            setRestrictions(restrictionsResult.data || []);

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
            // Limpa a linha de base globalmente antes de importar a nova
            const { error: deleteError } = await supabase.from('baseline_tasks').delete().neq('id', 'clear_all_rows');
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

    const saveRestriction = async (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { data, error } = await supabase.from('restrictions').insert([{ ...restriction, user_id: session.user.id }]).select();
            if (error) throw error;
            if (data?.[0]) {
                setRestrictions(prev => [...prev, data[0]]);
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const updateRestriction = async (id: string, updates: Partial<Restriction>) => {
        try {
            const { data, error } = await supabase.from('restrictions').update(updates).eq('id', id).select();
            if (error) throw error;
            if (data?.[0]) {
                setRestrictions(prev => prev.map(r => r.id === id ? data[0] : r));
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteRestriction = async (id: string) => {
        try {
            const { error } = await supabase.from('restrictions').delete().eq('id', id);
            if (error) throw error;
            setRestrictions(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };


    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: error.message };
        return { success: true };
    };

    const upgradeRole = async (newRole: User['role']) => {
        if (!session || !currentUser) return { success: false, error: 'Usuário não autenticado' };
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', currentUser.id);

            if (error) throw error;

            setCurrentUser(prev => prev ? { ...prev, role: newRole } : null);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    return (
        <DataContext.Provider value={{
            session, currentUser, allUsers, tasks, baselineTasks, restrictions, isLoading, refreshData,
            saveTask, deleteTask, importBaseline, saveRestriction, updateRestriction, deleteRestriction,
            cutOffDateStr, setCutOffDateStr, signOut, upgradeRole
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
