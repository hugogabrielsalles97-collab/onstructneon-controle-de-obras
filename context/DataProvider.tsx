import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { User, Task, Restriction, LeanTask } from '../types';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks, useBaselineTasks, useCurrentScheduleTasks, useRestrictions, useAllUsers, useCurrentUser, useLeanTasks } from '../hooks/dataHooks';

interface DataContextType {
    session: Session | null;
    currentUser: User | null;
    allUsers: User[];
    tasks: Task[];
    baselineTasks: Task[];
    currentScheduleTasks: Task[];
    leanTasks: LeanTask[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
    saveTask: (task: Task) => Promise<{ success: boolean; error?: string }>;
    deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    saveLeanTask: (task: LeanTask) => Promise<{ success: boolean; error?: string }>;
    deleteLeanTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    importBaseline: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>;
    importCurrentSchedule: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>;
    restrictions: Restriction[];
    saveRestriction: (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => Promise<{ success: boolean; error?: string }>;
    updateRestriction: (id: string, updates: Partial<Restriction>) => Promise<{ success: boolean; error?: string }>;
    deleteRestriction: (id: string) => Promise<{ success: boolean; error?: string }>;
    cutOffDateStr: string;
    setCutOffDateStr: (date: string) => void;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    upgradeRole: (newRole: User['role']) => Promise<{ success: boolean; error?: string }>;
    updateUser: (userId: string, updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
    deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
    isDevToolsOpen: boolean;
    setIsDevToolsOpen: (isOpen: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [cutOffDateStr, setCutOffDateStr] = useState('2026-01-10');
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const queryClient = useQueryClient();

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                setSession(session);
                setIsAuthLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                setIsAuthLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const userId = session?.user?.id;
    const isLoggedIn = !!session;

    // React Query Hooks
    const { data: currentUser, isLoading: loadingUser } = useCurrentUser(userId);
    const { data: allUsers = [], isLoading: loadingAllUsers } = useAllUsers(isLoggedIn);
    const { data: tasks = [], isLoading: loadingTasks } = useTasks(isLoggedIn);
    const { data: baselineTasks = [], isLoading: loadingBaseline } = useBaselineTasks(isLoggedIn);
    const { data: currentScheduleTasks = [], isLoading: loadingCurrentSchedule } = useCurrentScheduleTasks(isLoggedIn);
    const { data: restrictions = [], isLoading: loadingRestrictions } = useRestrictions(isLoggedIn);
    const { data: leanTasks = [], isLoading: loadingLeanTasks } = useLeanTasks(isLoggedIn);

    // isLoading logic:
    // 1. Auth is loading? -> True
    // 2. User logged in? -> Wait for queries
    // 3. User logged out? -> False (show login)
    const isLoading = isAuthLoading || (isLoggedIn && (loadingUser || loadingAllUsers || loadingTasks || loadingBaseline || loadingCurrentSchedule || loadingRestrictions || loadingLeanTasks));

    const refreshData = async () => {
        await queryClient.invalidateQueries();
    };

    const saveTask = async (task: Task) => {
        if (!session) return { success: false, error: 'No session' };

        const existingTask = tasks.find(t => t.id === task.id);

        try {
            if (existingTask) {
                // Update
                const { id, ...taskUpdates } = task;
                const { error } = await supabase.from('tasks').update({ ...taskUpdates, user_id: session.user.id }).eq('id', id);
                if (error) throw error;
            } else {
                // Insert
                const { id, ...taskData } = task;
                const { error } = await supabase.from('tasks').insert([{ ...taskData, user_id: session.user.id }]);
                if (error) throw error;
            }
            // Invalidate query to refetch data
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const saveLeanTask = async (task: LeanTask) => {
        if (!session) return { success: false, error: 'No session' };

        try {
            // Check if exists
            const existing = leanTasks.find(t => t.id === task.id);

            if (existing) {
                const { error } = await supabase
                    .from('lean_tasks')
                    .update({
                        task_data: task,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('lean_tasks')
                    .insert([{
                        id: task.id,
                        user_id: session.user.id,
                        task_data: task
                    }]);
                if (error) throw error;
            }

            queryClient.invalidateQueries({ queryKey: ['leanTasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteLeanTask = async (taskId: string) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { error } = await supabase.from('lean_tasks').delete().eq('id', taskId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['leanTasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteTask = async (taskId: string) => {
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            // Invalidate query to refetch data
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const importBaseline = async (newTasks: Task[]) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { error: deleteError } = await supabase.from('baseline_tasks').delete().neq('id', 'clear_all_rows');
            if (deleteError) throw deleteError;

            const tasksToInsert = newTasks.map(t => ({ ...t, user_id: session.user.id }));
            const step = 1000;

            // Batch insert to avoid limitations if needed, though supabase-js handles some, explicit is safer for large imports
            for (let i = 0; i < tasksToInsert.length; i += step) {
                const batch = tasksToInsert.slice(i, i + step);
                const { error: insertError } = await supabase.from('baseline_tasks').insert(batch);
                if (insertError) throw insertError;
            }

            queryClient.invalidateQueries({ queryKey: ['baselineTasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const importCurrentSchedule = async (newTasks: Task[]) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { error: deleteError } = await supabase.from('current_schedule_tasks').delete().neq('id', 'clear_all_rows');
            if (deleteError) throw deleteError;

            const tasksToInsert = newTasks.map(t => ({ ...t, user_id: session.user.id }));
            const step = 1000;

            for (let i = 0; i < tasksToInsert.length; i += step) {
                const batch = tasksToInsert.slice(i, i + step);
                const { error: insertError } = await supabase.from('current_schedule_tasks').insert(batch);
                if (insertError) throw insertError;
            }

            queryClient.invalidateQueries({ queryKey: ['currentScheduleTasks'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const saveRestriction = async (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => {
        if (!session) return { success: false, error: 'No session' };
        try {
            const { error } = await supabase.from('restrictions').insert([{ ...restriction, user_id: session.user.id }]);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['restrictions'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const updateRestriction = async (id: string, updates: Partial<Restriction>) => {
        try {
            const { error } = await supabase.from('restrictions').update(updates).eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['restrictions'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteRestriction = async (id: string) => {
        try {
            const { error } = await supabase.from('restrictions').delete().eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['restrictions'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: error.message };
        queryClient.clear(); // Clear cache on sign out
        return { success: true };
    };

    // Dev Tools State
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

    const upgradeRole = async (newRole: User['role']) => {
        if (!session || !currentUser) return { success: false, error: 'Usuário não autenticado' };
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', currentUser.id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const updateUser = async (userId: string, updates: Partial<User>) => {
        if (!session || currentUser?.role !== 'Master') return { success: false, error: 'Permissão negada' };
        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const deleteUser = async (userId: string) => {
        if (!session || currentUser?.role !== 'Master') return { success: false, error: 'Permissão negada' };
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    return (
        <DataContext.Provider value={{
            session, currentUser: currentUser || null, allUsers, tasks, baselineTasks, currentScheduleTasks, restrictions, leanTasks, isLoading, refreshData,
            saveTask, deleteTask, importBaseline, importCurrentSchedule, saveRestriction, updateRestriction, deleteRestriction, saveLeanTask, deleteLeanTask,
            cutOffDateStr, setCutOffDateStr, signOut, upgradeRole, updateUser, deleteUser, isDevToolsOpen, setIsDevToolsOpen
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
