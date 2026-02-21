import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { Task, User, Restriction, LeanTask, CheckoutLog, OrgMember } from '../types';

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
            return rows.map(r => ({ ...r.task_data, id: r.id }));
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
                .select(`id, username, role, fullName: full_name, whatsapp, is_approved`);
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
                .select(`id, username, role, fullName: full_name, whatsapp, is_approved`)
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

export const useCheckoutLogs = (enabled: boolean = true) => {
    return useQuery<CheckoutLog[]>({
        queryKey: ['checkoutLogs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('checkout_logs')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as CheckoutLog[];
        },
        enabled,
    });
};

export const useOrgMembers = (enabled: boolean = true) => {
    return useQuery<OrgMember[]>({
        queryKey: ['orgMembers'],
        queryFn: () => fetchAllRows('org_members'),
        enabled,
    });
};

export interface ProjectSettings {
    baseline_cutoff_date: string;
    current_schedule_cutoff_date: string;
}

export const useProjectSettings = (enabled: boolean = true) => {
    return useQuery<ProjectSettings>({
        queryKey: ['projectSettings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_settings')
                .select('baseline_cutoff_date, current_schedule_cutoff_date')
                .single();
            if (error) throw error;
            return data as ProjectSettings;
        },
        enabled,
        staleTime: 1000 * 60 * 5,
    });
};

export const useOrgMutations = () => {
    const queryClient = useQueryClient();

    const saveMember = useMutation({
        mutationFn: async (member: Partial<OrgMember>) => {
            if (member.id) {
                const { data, error } = await supabase
                    .from('org_members')
                    .update(member)
                    .eq('id', member.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from('org_members')
                    .insert(member)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orgMembers'] });
        },
    });

    const deleteMember = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('org_members')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orgMembers'] });
        },
    });

    return { saveMember, deleteMember };
};
