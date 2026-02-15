import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { Task, User, Restriction, LeanTask } from '../types';

// Helper function to fetch all rows (bypass Supabase 1000 limit)
const fetchAllRows = async (tableName: string) => {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + step - 1);

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            throw error;
        }

        if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            if (data.length < step) break; // Chegou ao fim
            from += step;
        } else {
            break;
        }
    }
    return allRows;
};

export const useTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['tasks'],
        queryFn: () => fetchAllRows('tasks'),
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes stale time
    });
};

export const useLeanTasks = (enabled: boolean = true) => {
    return useQuery<LeanTask[]>({
        queryKey: ['leanTasks'],
        queryFn: async () => {
            const rows = await fetchAllRows('lean_tasks');
            return rows.map(r => ({ ...r.task_data, id: r.id })); // Merge task_data JSON back into flat structure if needed, or keep as is.
            // Actually, since I stored `task_data` as a JSONB column, I need to extract it.
            // And I decided to keep `id` as the primary key in the table.
            // The object structure in the frontend has `id` inside it.
        },
        enabled,
        staleTime: 1000 * 60 * 5,
    });
};

export const useBaselineTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['baselineTasks'],
        queryFn: () => fetchAllRows('baseline_tasks'),
        enabled,
        staleTime: 1000 * 60 * 60, // 1 hour (less frequent changes)
    });
};

export const useCurrentScheduleTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['currentScheduleTasks'],
        queryFn: () => fetchAllRows('current_schedule_tasks'),
        enabled,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useRestrictions = (enabled: boolean = true) => {
    return useQuery<Restriction[]>({
        queryKey: ['restrictions'],
        queryFn: () => fetchAllRows('restrictions'),
        enabled,
    });
};

export const useAllUsers = (enabled: boolean = true) => {
    return useQuery<User[]>({
        queryKey: ['allUsers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select(`id, username, role, fullName: full_name, whatsapp`);
            if (error) throw error;
            return data as User[];
        },
        enabled,
    });
};

export const useCurrentUser = (userId: string | undefined) => {
    return useQuery<User | null>({
        queryKey: ['currentUser', userId],
        queryFn: async () => {
            if (!userId) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select(`id, username, role, fullName: full_name, whatsapp`)
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Check if this is the master user and update role if necessary
            if (data.username === 'hugo.sales@egtc.com.br' && data.role !== 'Master') {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: 'Master' })
                    .eq('id', data.id);

                if (!updateError) {
                    data.role = 'Master';
                }
            }
            return data as User;
        },
        enabled: !!userId,
    });
};
