import * as XLSX from 'xlsx';
import { Task } from '../types';

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
