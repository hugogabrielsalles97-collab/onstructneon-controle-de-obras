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

// ==========================================
// OTIMIZADO: Busca sequencial com paginação menor
// para reduzir consumo de RAM e Disk I/O no Supabase
// ==========================================
const fetchAllRows = async (tableName: string, columns: string = '*') => {
    try {
        const step = 500; // Reduzido de 1000 para 500 para menos pressão no disco

        // 1. Obter o count total primeiro (requisição leve, head: true)
        const { count, error: countError } = await supabase
            .from(tableName)
            .select(columns, { count: 'exact', head: true });

        if (countError) throw countError;
        if (count === 0 || count === null) return [];

        const totalPages = Math.ceil(count / step);

        // Se cabe em uma página, busca direto
        if (totalPages === 1) {
            const { data, error } = await supabase.from(tableName).select(columns);
            if (error) throw error;
            return data || [];
        }

        // 2. Busca SEQUENCIAL (uma página por vez) para não sobrecarregar o Supabase
        let allRows: any[] = [];
        for (let i = 0; i < totalPages; i++) {
            const from = i * step;
            const { data, error } = await supabase
                .from(tableName)
                .select(columns)
                .range(from, from + step - 1);

            if (error) throw error;
            if (data) allRows = allRows.concat(data);
        }

        return allRows;
    } catch (err) {
        console.error(`Erro ao buscar ${tableName}:`, err);
        return [];
    }
};

export const useTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['tasks'],
        queryFn: () => fetchAllRows('tasks'),
        enabled,
        staleTime: 1000 * 60 * 15, // 15 min (era 5 min)
        gcTime: 1000 * 60 * 30, // Mantém em cache por 30 min
        refetchOnWindowFocus: false, // NÃO rebuscar ao focar janela
        refetchOnReconnect: false,
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
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

export const useBaselineTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['baselineTasks'],
        queryFn: () => fetchAllRows('baseline_tasks'),
        enabled,
        staleTime: 1000 * 60 * 60 * 4, // 4 horas (baseline quase nunca muda)
        gcTime: 1000 * 60 * 60 * 6,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

export const useCurrentScheduleTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['currentScheduleTasks'],
        queryFn: () => fetchAllRows('current_schedule_tasks'),
        enabled,
        staleTime: 1000 * 60 * 60 * 2, // 2 horas
        gcTime: 1000 * 60 * 60 * 4,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

export const useRestrictions = (enabled: boolean = true) => {
    return useQuery<Restriction[]>({
        queryKey: ['restrictions'],
        queryFn: () => fetchAllRows('restrictions'),
        enabled,
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
        staleTime: 1000 * 60 * 30, // 30 min (lista de usuarios muda raramente)
        refetchOnWindowFocus: false,
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
            // Buscar apenas os últimos 500 logs (ordenados no servidor), evitando carregar histórico completo
            const { data, error } = await supabase
                .from('checkout_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            return (data || []) as CheckoutLog[];
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 min
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

export const useOrgMembers = (enabled: boolean = true) => {
    return useQuery<OrgMember[]>({
        queryKey: ['orgMembers'],
        queryFn: () => fetchAllRows('org_members'),
        enabled,
        staleTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

export const useCatalogs = (enabled: boolean = true) => {
    return useQuery<CatalogItem[]>({
        queryKey: ['catalogs'],
        queryFn: () => fetchAllRows('activity_catalogs'),
        enabled,
        staleTime: 1000 * 60 * 60, // 1 hora
        gcTime: 1000 * 60 * 60 * 2,
        refetchOnWindowFocus: false,
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
        staleTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
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
