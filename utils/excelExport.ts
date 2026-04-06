import * as XLSX from 'xlsx';
import { Task, TaskStatus } from '../types';
import { supabase } from '../supabaseClient';

export const exportTasksToExcel = (tasks: Task[], fileName: string) => {
    // Ordenar tarefas por nível e título para um Excel mais organizado
    const sortedTasks = [...tasks].sort((a, b) => {
        const levelCompare = (a.level || '').localeCompare(b.level || '');
        if (levelCompare !== 0) return levelCompare;
        return (a.title || '').localeCompare(b.title || '');
    });

    const worksheetData = sortedTasks.map(task => ({
        'ID': task.id,
        'Título': task.title,
        'Descrição': task.description || '',
        'Status': task.status,
        'Responsável': task.assignee,
        'Disciplina': task.discipline,
        'Local / Frente': task.location,
        'Nível': task.level,
        'Apoio': task.support,
        'Corte': task.corte || '',
        'Início Previsto': task.startDate,
        'Fim Previsto': task.dueDate,
        'Início Real': task.actualStartDate || '',
        'Fim Real': task.actualEndDate || '',
        'Quantidade Planejada': task.quantity,
        'Unidade': task.unit,
        'Quantidade Real': task.actualQuantity || 0,
        'Progresso (%)': task.progress,
        'Observações': task.observations || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tarefas');

    // Configurar larguras de coluna para melhor visualização
    const wscols = [
        { wch: 10 }, // ID
        { wch: 35 }, // Título
        { wch: 45 }, // Descrição
        { wch: 18 }, // Status
        { wch: 25 }, // Responsável
        { wch: 25 }, // Disciplina
        { wch: 25 }, // Local / Frente
        { wch: 15 }, // Nível
        { wch: 15 }, // Apoio
        { wch: 15 }, // Corte
        { wch: 18 }, // Início Previsto
        { wch: 18 }, // Fim Previsto
        { wch: 18 }, // Início Real
        { wch: 18 }, // Fim Real
        { wch: 20 }, // Quantidade Planejada
        { wch: 10 }, // Unidade
        { wch: 18 }, // Quantidade Real
        { wch: 15 }, // Progresso (%)
        { wch: 50 }  // Observações
    ];
    worksheet['!cols'] = wscols;

    // Trigger download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

// =====================================================================
// RELATÓRIO SEMANAL REALIZADO — Dia a dia com resumo de colaboradores
// =====================================================================

const formatDateBR = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const getDayOfWeek = (dateStr: string): string => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = new Date(dateStr + 'T12:00:00');
    return days[d.getDay()];
};

export const exportWeeklyReportToExcel = async (
    tasks: Task[],
    startDate: string,
    endDate: string,
): Promise<{ success: boolean; error?: string; count?: number }> => {
    try {
        // 1. Gerar todas as datas do período
        const dates: string[] = [];
        const currentDate = new Date(startDate + 'T12:00:00');
        const endDateObj = new Date(endDate + 'T12:00:00');

        while (currentDate <= endDateObj) {
            dates.push(currentDate.toISOString().slice(0, 10));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (dates.length === 0) {
            return { success: false, error: 'Período de datas inválido.' };
        }

        // 2. Filtrar tarefas que foram REALIZADAS e cruzam com o período
        //    "Realizado" = tarefa que foi iniciada (tem actualStartDate ou status != A Iniciar)
        const realizedTasks = tasks.filter(t => {
            // Precisa ter sido iniciada
            if (!t.actualStartDate && t.status === TaskStatus.ToDo) return false;

            // Período de execução da tarefa
            const taskStart = t.actualStartDate || t.startDate;
            const taskEnd = t.actualEndDate || t.dueDate;
            if (!taskStart || !taskEnd) return false;

            // Deve cruzar com o período selecionado
            return taskStart <= endDate && taskEnd >= startDate;
        });

        if (realizedTasks.length === 0) {
            return { success: false, error: 'Nenhuma tarefa realizada encontrada no período selecionado.' };
        }

        // 3. Buscar dados de mão de obra (actualManpower / plannedManpower) em lote
        const taskIds = realizedTasks.map(t => t.id);
        const manpowerMap = new Map<string, { actual: any[]; planned: any[] }>();

        // Chunks de 100 para evitar limite de URL do PostgREST
        const chunkSize = 100;
        for (let i = 0; i < taskIds.length; i += chunkSize) {
            const chunk = taskIds.slice(i, i + chunkSize);
            const { data, error } = await supabase
                .from('tasks')
                .select('id, "actualManpower", "plannedManpower"')
                .in('id', chunk);

            if (error) throw error;

            (data || []).forEach((row: any) => {
                manpowerMap.set(row.id, {
                    actual: row.actualManpower || [],
                    planned: row.plannedManpower || [],
                });
            });
        }

        // 4. Coletar todas as funções (roles) únicas para criar colunas dinâmicas
        const allRoles = new Set<string>();
        manpowerMap.forEach(({ actual, planned }) => {
            const resources = actual.length > 0 ? actual : planned;
            resources.forEach((r: any) => {
                if (r.role) allRoles.add(r.role);
            });
        });
        const rolesList = Array.from(allRoles).sort();

        // 5. Montar linhas do relatório — dia a dia
        const rows: any[] = [];

        for (const dateStr of dates) {
            // Tarefas ativas neste dia
            const activeTasks = realizedTasks.filter(t => {
                const taskStart = t.actualStartDate || t.startDate;
                const taskEnd = t.actualEndDate || t.dueDate;
                return dateStr >= taskStart! && dateStr <= taskEnd!;
            });

            if (activeTasks.length === 0) continue; // Pular dias sem atividade

            for (const task of activeTasks) {
                const mp = manpowerMap.get(task.id);
                const resources = mp && mp.actual.length > 0 ? mp.actual : (mp?.planned || []);

                const row: any = {
                    'Data': formatDateBR(dateStr),
                    'Dia': getDayOfWeek(dateStr),
                    'Tarefa': task.title,
                    'Disciplina': task.discipline || '',
                    'Nível': task.level || '',
                    'Responsável': task.assignee || '',
                    'Localização': task.location || '',
                    'Apoio': task.support || '',
                };

                // Colunas dinâmicas: uma por função com a quantidade
                let totalWorkers = 0;
                for (const role of rolesList) {
                    const resource = resources.find((r: any) => r.role === role);
                    const qty = resource ? resource.quantity : 0;
                    row[role] = qty > 0 ? qty : '';
                    totalWorkers += qty;
                }

                row['Total Colaboradores'] = totalWorkers > 0 ? totalWorkers : '';

                rows.push(row);
            }
        }

        if (rows.length === 0) {
            return { success: false, error: 'Nenhum dado encontrado para gerar o relatório no período.' };
        }

        // 6. Gerar planilha Excel
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Realizado');

        // Larguras personalizadas
        const fixedCols = [
            { wch: 12 },  // Data
            { wch: 12 },  // Dia
            { wch: 40 },  // Tarefa
            { wch: 22 },  // Disciplina
            { wch: 15 },  // Nível
            { wch: 28 },  // Responsável
            { wch: 22 },  // Localização
            { wch: 15 },  // Apoio
        ];
        const roleCols = rolesList.map(r => ({ wch: Math.max(r.length + 4, 16) }));
        const totalCol = [{ wch: 20 }];
        worksheet['!cols'] = [...fixedCols, ...roleCols, ...totalCol];

        // Congelar cabeçalho (primeira linha)
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Download do arquivo
        const dateLabel = `${startDate.replace(/-/g, '')}_a_${endDate.replace(/-/g, '')}`;
        XLSX.writeFile(workbook, `Relatorio_Realizado_${dateLabel}.xlsx`);

        return { success: true, count: rows.length };
    } catch (err: any) {
        console.error('Erro ao gerar relatório semanal:', err);
        return { success: false, error: err.message || 'Erro desconhecido ao gerar relatório.' };
    }
};
