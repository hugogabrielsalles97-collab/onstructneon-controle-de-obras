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
// COLUNAS LEVES (sem JSONB pesados como plannedManpower, photos, etc.)
// Isso reduz drasticamente o consumo de RAM e Disk I/O
// ==========================================
const TASK_LIGHT_COLUMNS = `
    id, title, description, status, assignee, discipline, level,
    "startDate", "dueDate", "actualStartDate", "actualEndDate",
    location, support, side, corte, shift,
    quantity, unit, "actualQuantity", progress,
    observations, baseline_id, user_id, created_at
`.replace(/\s+/g, ' ').trim();

// Colunas pesadas (JSONB) — carregadas SOMENTE quando necessário
const TASK_HEAVY_COLUMNS = `"plannedManpower", "plannedMachinery", "actualManpower", "actualMachinery", photos, "rescheduleHistory"`;

// ==========================================
// Busca paginada e sequencial
// ==========================================
const fetchAllRows = async (tableName: string, columns: string = '*') => {
    try {
        const step = 200; // Reduzido de 500 para 200: alivia a RAM do PostgREST/V8 em cada pedido
        let allRows: any[] = [];
        let from = 0;
        let hasMore = true;

        // BEM MAIS LEVE: Ao invés de usar `count: 'exact'` (que força o Supabase a ler
        // a tabela inteira do zero consumindo RAM absurdamente), nós apenas tentamos 
        // puxar as linhas e paramos quando vier menos que a capacidade máxima da página.
        while (hasMore) {
            const { data, error } = await supabase
                .from(tableName)
                .select(columns)
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRows = allRows.concat(data);
                if (data.length < step) {
                    hasMore = false; // Última página
                } else {
                    from += step; // Próxima página
                }
            } else {
                hasMore = false; // Vazio, acabou
            }
        }

        return allRows;
    } catch (err) {
        console.error(`Erro ao buscar ${tableName}:`, err);
        return [];
    }
};

// ==========================================
// Buscar IDs das tarefas com fotos (query leve — só transfere IDs)
// Usa RPC se disponível, senão fallback com checagem local
// ==========================================
export const fetchTaskIdsWithPhotos = async (): Promise<Set<string>> => {
    try {
        // Tenta usar a RPC function (mais eficiente — filtragem no banco)
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_task_ids_with_photos');

        if (!rpcError && rpcData) {
            return new Set(rpcData.map((r: any) => r.id));
        }

        // Fallback: busca id e apenas o 1º elemento de photos (arrow JSONB)
        // Se photos->0 não for null, a tarefa tem pelo menos 1 foto
        const { data, error } = await supabase
            .from('tasks')
            .select('id, first_photo:photos->0');

        if (error) {
            // Se o arrow não funcionar, busca tudo e filtra localmente
            const { data: fullData, error: fullError } = await supabase
                .from('tasks')
                .select('id, photos');
            if (fullError) throw fullError;

            const ids = (fullData || [])
                .filter((r: any) => r.photos && Array.isArray(r.photos) && r.photos.length > 0)
                .map((r: any) => r.id);
            return new Set(ids);
        }

        const ids = (data || [])
            .filter((r: any) => r.first_photo !== null && r.first_photo !== undefined)
            .map((r: any) => r.id);

        return new Set(ids);
    } catch (err) {
        console.warn('Erro ao verificar quais tarefas têm fotos:', err);
        return new Set();
    }
};

// ==========================================
// Buscar dados pesados de UMA tarefa específica (sob demanda)
// ==========================================
export const fetchTaskHeavyData = async (taskId: string, tableName: string = 'tasks') => {
    const { data, error } = await supabase
        .from(tableName)
        .select(TASK_HEAVY_COLUMNS)
        .eq('id', taskId)
        .single();
    if (error) throw error;
    return data;
};

// ==========================================
// Resumo de trabalhadores para o Controle Visual (via RPC)
// Faz a agregação no banco; não transfere JSONB pesados.
// ==========================================
export interface VisualControlWorkerRow {
    task_id: string;
    task_title: string;
    task_location: string;
    task_assignee: string | null;
    task_support: string | null;
    task_shift: string | null;
    manpower_role: string;
    manpower_qty: number;
}

export const useVisualControlWorkers = (filterDate: string, enabled: boolean = true) => {
    return useQuery<VisualControlWorkerRow[]>({
        queryKey: ['visualControlWorkers', filterDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('get_visual_control_workers', { p_date: filterDate });

            if (error) {
                console.warn('RPC get_visual_control_workers falhou, usando fallback:', error.message);
                // Fallback: busca colunas leves + apenas plannedManpower
                const { data: fallbackData, error: fbError } = await supabase
                    .from('tasks')
                    .select('id, title, location, assignee, support, shift, "plannedManpower", "startDate", "dueDate"')
                    .not('location', 'is', null);

                if (fbError) throw fbError;

                const rows: VisualControlWorkerRow[] = [];
                (fallbackData || []).forEach((t: any) => {
                    const start = new Date(t.startDate + 'T00:00:00');
                    const end = new Date(t.dueDate + 'T23:59:59');
                    const sel = new Date(filterDate + 'T12:00:00');
                    if (sel < start || sel > end) return;

                    (t.plannedManpower || []).forEach((mp: any) => {
                        if (mp.role && mp.quantity > 0) {
                            rows.push({
                                task_id: t.id,
                                task_title: t.title,
                                task_location: t.location,
                                task_assignee: t.assignee || null,
                                task_support: t.support || null,
                                task_shift: t.shift || null,
                                manpower_role: mp.role,
                                manpower_qty: mp.quantity,
                            });
                        }
                    });
                });
                return rows;
            }

            return (data || []) as VisualControlWorkerRow[];
        },
        enabled,
        staleTime: 1000 * 60 * 5,      // 5 min
        gcTime: 1000 * 60 * 15,         // 15 min
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

// ==========================================
// HOOKS — com colunas LEVES (sem JSONB pesado)
// ==========================================

export const useTasks = (enabled: boolean = true) => {
    return useQuery<Task[]>({
        queryKey: ['tasks'],
        queryFn: () => fetchAllRows('tasks', TASK_LIGHT_COLUMNS),
        enabled,
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

export const useLeanTasks = (enabled: boolean = true) => {
    return useQuery<LeanTask[]>({
        queryKey: ['leanTasks'],
        queryFn: async () => {
            // Busca leve: só id e task_data (necessário, mas carrega sob demanda pela paginação)
            const rows = await fetchAllRows('lean_tasks', 'id, task_data');
            return rows.map(r => ({ ...r.task_data, id: r.id }));
        },
        enabled,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 45,       // Reduzido de 60min para 45min
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

// BASELINE e CURRENT_SCHEDULE: desabilitados por padrão (enabled=false)
// Só carregam quando a página específica ativa via setEnabled
export const useBaselineTasks = (enabled: boolean = false) => {
    return useQuery<Task[]>({
        queryKey: ['baselineTasks'],
        queryFn: () => fetchAllRows('baseline_tasks', TASK_LIGHT_COLUMNS),
        enabled,
        staleTime: 1000 * 60 * 60 * 8, // 8 horas
        gcTime: 1000 * 60 * 60 * 12,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

export const useCurrentScheduleTasks = (enabled: boolean = false) => {
    return useQuery<Task[]>({
        queryKey: ['currentScheduleTasks'],
        queryFn: () => fetchAllRows('current_schedule_tasks', TASK_LIGHT_COLUMNS),
        enabled,
        staleTime: 1000 * 60 * 60 * 4, // 4 horas
        gcTime: 1000 * 60 * 60 * 8,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
    });
};

// Colunas específicas para restrictions (evita SELECT *)
const RESTRICTION_COLUMNS = `
    id, baseline_task_id, type, description, status, priority,
    responsible, department, due_date, created_at, resolved_at,
    resolution_notes, actual_start_date, actual_completion_date, user_id
`.replace(/\s+/g, ' ').trim();

export const useRestrictions = (enabled: boolean = true) => {
    return useQuery<Restriction[]>({
        queryKey: ['restrictions'],
        queryFn: () => fetchAllRows('restrictions', RESTRICTION_COLUMNS),
        enabled,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 45,       // Reduzido de 60min para 45min
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
        staleTime: 1000 * 60 * 60,
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
        staleTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

// Checkout logs: limit reduzido + gcTime curto para aliviar memória
export const useCheckoutLogs = (enabled: boolean = true) => {
    return useQuery<CheckoutLog[]>({
        queryKey: ['checkoutLogs'],
        queryFn: async () => {
            // Limit reduzido de 200→80 para diminuir transferência de JSONB 'changes'
            const { data, error } = await supabase
                .from('checkout_logs')
                .select('id, task_id, task_title, user_id, user_name, created_at, changes')
                .order('created_at', { ascending: false })
                .limit(80);
            if (error) throw error;
            return (data || []) as CheckoutLog[];
        },
        enabled,
        staleTime: 1000 * 60 * 10,         // 10 min (reduzido de 15)
        gcTime: 1000 * 60 * 20,             // 20 min — libera cache rápido
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

// Buscar detalhes (changes JSONB) de UM log específico — sob demanda
export const fetchCheckoutLogDetails = async (logId: string) => {
    const { data, error } = await supabase
        .from('checkout_logs')
        .select('id, changes')
        .eq('id', logId)
        .single();
    if (error) throw error;
    return data;
};

export const useOrgMembers = (enabled: boolean = true) => {
    return useQuery<OrgMember[]>({
        queryKey: ['orgMembers'],
        queryFn: () => fetchAllRows('org_members', 'id, name, role, quantity, parent_id, user_id, created_at'),
        enabled,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 2,
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

export const useCatalogs = (enabled: boolean = true) => {
    return useQuery<CatalogItem[]>({
        queryKey: ['catalogs'],
        queryFn: () => fetchAllRows('activity_catalogs'),
        enabled,
        staleTime: 1000 * 60 * 60 * 2,
        gcTime: 1000 * 60 * 60 * 4,
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
        staleTime: 1000 * 60 * 60,
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
