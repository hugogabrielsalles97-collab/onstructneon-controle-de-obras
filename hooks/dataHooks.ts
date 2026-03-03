import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { Task, User, Restriction, LeanTask, CheckoutLog, OrgMember } from '../types';

export interface CatalogItem {
    id: string;
    discipline: string;
    level: string | null;
    activity_title: string | null;
    created_at?: string;
}

// Helper function to fetch all rows (bypass Supabase 1000 limit)
const fetchAllRows = async (tableName: string) => {
    try {
        // 1. Obter o count total primeiro para saber quantas páginas buscar
        const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        if (!count) return [];

        const step = 1000;
        const totalPages = Math.ceil(count / step);

        // Se for apenas uma página, busca direto
        if (totalPages === 1) {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) throw error;
            return data || [];
        }

        // 2. Criar promessas para buscar todas as páginas em PARALELO
        const promises = [];
        for (let i = 0; i < totalPages; i++) {
            const from = i * step;
            promises.push(
                supabase
                    .from(tableName)
                    .select('*')
                    .range(from, from + step - 1)
                    .then(({ data, error }) => {
                        if (error) throw error;
                        return data || [];
                    })
            );
        }

        // 3. Aguardar todas as buscas terminarem
        const results = await Promise.all(promises);

        // 4. Achatar o array de resultados
        return results.flat();
    } catch (err) {
        console.error(`Erro crítico ao buscar ${tableName} em paralelo:`, err);

        // Fallback para busca sequencial segura caso a paralela falhe (ex: limite de conexões)
        let allRows: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
            const { data, error } = await supabase.from(tableName).select('*').range(from, from + step - 1);
            if (error || !data || data.length === 0) break;
            allRows = [...allRows, ...data];
            if (data.length < step) break;
            from += step;
        }
        return allRows;
    }
};

export const useTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['tasks'],
        queryFn: () => fetchAllRows('tasks'),
        enabled,
        staleTime: 1000 * 60 * 5,
        retry: 1,
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
        retry: 1,
    });
};

export const useBaselineTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['baselineTasks'],
        queryFn: () => fetchAllRows('baseline_tasks'),
        enabled,
        staleTime: 1000 * 60 * 60,
        retry: 1,
    });
};

export const useCurrentScheduleTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['currentScheduleTasks'],
        queryFn: () => fetchAllRows('current_schedule_tasks'),
        enabled,
        staleTime: 1000 * 60 * 30,
        retry: 1,
    });
};

export const useRestrictions = (enabled: boolean = true) => {
    return useQuery<Restriction[]>({
        queryKey: ['restrictions'],
        queryFn: () => fetchAllRows('restrictions'),
        enabled,
        retry: 1,
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
        retry: 1,
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
        retry: 1,
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
        retry: 1,
    });
};

export const useOrgMembers = (enabled: boolean = true) => {
    return useQuery<OrgMember[]>({
        queryKey: ['orgMembers'],
        queryFn: () => fetchAllRows('org_members'),
        enabled,
        retry: 1,
    });
};

export const useCatalogs = (enabled: boolean = true) => {
    return useQuery<CatalogItem[]>({
        queryKey: ['catalogs'],
        queryFn: () => fetchAllRows('activity_catalogs'),
        enabled,
        staleTime: 1000 * 60 * 30,
        retry: 1,
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
        retry: 1,
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
