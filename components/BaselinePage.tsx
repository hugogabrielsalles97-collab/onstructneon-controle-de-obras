import React, { useState, useCallback, useEffect } from 'react';
import { User, Task, TaskStatus } from '../types';
import { useData } from '../context/DataProvider';
import Header from './Header';
import BaselineIcon from './icons/BaselineIcon';
import ExcelIcon from './icons/ExcelIcon';
import Sidebar from './Sidebar';
import { exportTasksToExcel } from '../utils/excelExport';

// Esta variável global é declarada pelo script tag da biblioteca xlsx em index.html
declare var XLSX: any;

interface BaselinePageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCost: () => void;
    onNavigateToHome?: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToTeams?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const REQUIRED_FIELDS = {
    'ID': 'ID (Identificador único para cada tarefa)',
    'Título': 'Título da tarefa',
    'Responsável': 'Responsável pela execução',
    'Disciplina': 'Disciplina (ex: Estrutura)',
    'Nível': 'Nível/Pavimento',
    'Início Previsto': 'Data de início planejada',
    'Fim Previsto': 'Data de término planejada',
    'Quantidade': 'Quantidade planejada do serviço',
    'Unidade': 'Unidade de medida (m³, un, etc.)',
    'Local / Frente': 'Local ou frente de serviço'
};

const OPTIONAL_FIELDS = {
    'Descrição': 'Descrição detalhada da tarefa',
    'Apoio': 'Apoio necessário',
    'Corte': 'Informação de corte/estaca',
    'Progresso': 'Percentual de avanço (0-100)'
};

const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const BaselinePage: React.FC<BaselinePageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToHome,
    onUpgradeClick,
    onNavigateToOrgChart, onNavigateToVisualControl,
    onNavigateToCheckoutSummary,
    onNavigateToTeams,
    showToast
}) => {
    const { currentUser: user, baselineTasks, importBaseline, signOut, baselineCutOffDateStr, setBaselineCutOffDateStr } = useData();
    const [isImporting, setIsImporting] = useState(baselineTasks.length === 0);
    const [file, setFile] = useState<File | null>(null);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [importedTasks, setImportedTasks] = useState<Task[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    const handleImport = async (tasks: Task[]) => {
        const { success, error } = await importBaseline(tasks);
        if (success) {
            showToast('Linha de base importada com sucesso!', 'success');
            setIsImporting(false);
            resetImportState();
        } else if (error) {
            showToast(`Erro ao importar linha de base: ${error}`, 'error');
        }
    };


    const resetImportState = () => {
        setFile(null);
        setFileHeaders([]);
        setColumnMapping({});
        setImportedTasks([]);
        setError(null);
        setIsProcessing(false);
    };

    const handleFileSelected = (selectedFile: File) => {
        resetImportState();
        setIsProcessing(true);
        setError(null);
        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[] || []).map(h => String(h || '').trim()).filter(Boolean);

                if (headers.length === 0) {
                    throw new Error("Não foram encontrados cabeçalhos na planilha.");
                }

                setFileHeaders(headers);
            } catch (err: any) {
                setError(`Erro ao ler os cabeçalhos do arquivo: ${err.message}`);
                resetImportState();
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            setError("Não foi possível ler o arquivo.");
            setIsProcessing(false);
        };
        reader.readAsBinaryString(selectedFile);
    };

    useEffect(() => {
        if (fileHeaders.length > 0) {
            const newMapping: Record<string, string> = {};
            const allAppFields = { ...REQUIRED_FIELDS, ...OPTIONAL_FIELDS };
            Object.keys(allAppFields).forEach(appField => {
                const foundHeader = fileHeaders.find(fileHeader => fileHeader.toLowerCase().replace(/\s+/g, '') === appField.toLowerCase().replace(/\s+/g, ''));
                if (foundHeader) {
                    newMapping[appField] = foundHeader;
                }
            });
            setColumnMapping(newMapping);
        }
    }, [fileHeaders]);

    const handleMappingChange = (appField: string, fileHeader: string) => {
        setColumnMapping(prev => ({ ...prev, [appField]: fileHeader }));
    };

    const processAndPreview = () => {
        if (!file) return;

        const missingMappings = Object.keys(REQUIRED_FIELDS).filter(field => !columnMapping[field]);
        if (missingMappings.length > 0) {
            setError(`Mapeamento obrigatório ausente para: ${missingMappings.join(', ')}`);
            return;
        }

        setIsProcessing(true);
        setError(null);
        setImportedTasks([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length < 1) throw new Error("A planilha não contém dados.");

                const tasks: Task[] = json.map((row: any, index) => {
                    const getValue = (header: string) => {
                        const mappedHeader = columnMapping[header];
                        return mappedHeader ? row[mappedHeader] : undefined;
                    }

                    const id = getValue('ID');
                    const title = getValue('Título');
                    if (!id || !title) return null;

                    const startDateRaw = getValue('Início Previsto');
                    const dueDateRaw = getValue('Fim Previsto');

                    if (!startDateRaw && !dueDateRaw) {
                        throw new Error(`É necessário ter 'Início Previsto' ou 'Fim Previsto' na linha ${index + 2}.`);
                    }
                    if (startDateRaw && !(startDateRaw instanceof Date)) {
                        throw new Error(`Formato de data inválido para 'Início Previsto' na linha ${index + 2}.`);
                    }
                    if (dueDateRaw && !(dueDateRaw instanceof Date)) {
                        throw new Error(`Formato de data inválido para 'Fim Previsto' na linha ${index + 2}.`);
                    }

                    const finalStartDate = startDateRaw || dueDateRaw;
                    const finalDueDate = dueDateRaw || startDateRaw;

                    return {
                        id: String(id),
                        title: String(title),
                        description: String(getValue('Descrição') || ''),
                        status: TaskStatus.ToDo,
                        assignee: String(getValue('Responsável')),
                        discipline: String(getValue('Disciplina')),
                        level: String(getValue('Nível')),
                        startDate: finalStartDate.toISOString().split('T')[0],
                        dueDate: finalDueDate.toISOString().split('T')[0],
                        location: String(getValue('Local / Frente')),
                        support: String(getValue('Apoio') || ''),
                        corte: String(getValue('Corte') || ''),
                        quantity: Number(getValue('Quantidade') || 0),
                        unit: String(getValue('Unidade')),
                        progress: Number(getValue('Progresso') || 0),
                        plannedManpower: [],
                        plannedMachinery: [],
                    };
                }).filter((task): task is Task => task !== null);

                if (tasks.length === 0) {
                    throw new Error("Nenhuma tarefa válida encontrada na planilha. Verifique o mapeamento e os dados das colunas 'ID' e 'Título'.");
                }
                setImportedTasks(tasks);

            } catch (err: any) {
                setError(`Erro ao processar o arquivo: ${err.message}`);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSave = () => {
        if (importedTasks.length > 0) {
            handleImport(importedTasks);
            setIsImporting(false);
            resetImportState();
        }
    };

    const isMappingComplete = Object.keys(REQUIRED_FIELDS).every(field => columnMapping[field]);

    const ImportView = () => (
        <div className="bg-brand-dark/70 p-6 rounded-lg animate-fade-in space-y-8">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-100">Importar Nova Linha Base</h3>
                {baselineTasks.length > 0 && (
                    <button
                        onClick={() => { setIsImporting(false); resetImportState(); }}
                        className="bg-brand-dark/80 text-brand-med-gray px-4 py-2 rounded-md hover:bg-brand-dark transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                )}
            </div>
            {/* Step 1: File Upload */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-semibold text-gray-100 mb-2">Passo 1: Instruções</h3>
                    <p className="text-sm text-brand-med-gray">
                        Envie seu cronograma em formato XLSX. O sistema se adaptará à sua planilha através do mapeamento de colunas.
                    </p>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-100 mb-2">Carregar Arquivo</h3>
                    <div
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileSelected(e.dataTransfer.files[0]) }}
                        onDragOver={(e) => e.preventDefault()}
                        className="relative border-2 border-dashed border-brand-med-gray/50 rounded-lg p-12 text-center cursor-pointer hover:border-brand-accent transition-colors"
                    >
                        <input type="file" id="file-upload" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".xlsx, .xls" onChange={(e) => e.target.files && handleFileSelected(e.target.files[0])} />
                        <p className="text-brand-med-gray">{file ? `Arquivo: ${file.name}` : 'Arraste e solte ou clique para selecionar.'}</p>
                    </div>
                </div>
            </div>

            {/* Step 2: Column Mapping */}
            {fileHeaders.length > 0 && (
                <div className="border-t border-brand-accent/30 pt-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4">Passo 2: Mapeamento de Colunas</h3>
                    <p className="text-sm text-brand-med-gray mb-4">Associe os campos do aplicativo às colunas da sua planilha.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-brand-darkest/50 p-4 rounded-md">
                        {Object.entries(REQUIRED_FIELDS).map(([key, desc]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-200">{key} <span className="text-red-500">*</span></label>
                                <p className="text-xs text-brand-med-gray mb-1 h-8">{desc}</p>
                                <select value={columnMapping[key] || ''} onChange={(e) => handleMappingChange(key, e.target.value)} className="mt-1 block w-full bg-brand-darkest/80 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent">
                                    <option value="">Selecione a coluna...</option>
                                    {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        ))}
                        {Object.entries(OPTIONAL_FIELDS).map(([key, desc]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-200">{key}</label>
                                <p className="text-xs text-brand-med-gray mb-1 h-8">{desc}</p>
                                <select value={columnMapping[key] || ''} onChange={(e) => handleMappingChange(key, e.target.value)} className="mt-1 block w-full bg-brand-darkest/80 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent">
                                    <option value="">Nenhuma</option>
                                    {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={processAndPreview} disabled={!isMappingComplete || isProcessing} className="px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-orange-600 transition shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {isProcessing ? 'Processando...' : 'Processar e Visualizar'}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 text-center text-sm text-red-400 bg-red-500/10 p-3 rounded-md">
                    {error}
                </div>
            )}

            {/* Step 3: Preview & Save */}
            {importedTasks.length > 0 && (
                <div className="border-t border-brand-accent/30 pt-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-2">Passo 3: Pré-visualização e Confirmação ({importedTasks.length} tarefas encontradas)</h3>
                    <div className="max-h-60 overflow-y-auto bg-brand-darkest/50 rounded-md">
                        <table className="min-w-full text-sm">
                            <thead className="bg-brand-darkest/80 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-brand-med-gray">ID</th>
                                    <th className="px-3 py-2 text-left font-medium text-brand-med-gray">Título</th>
                                    <th className="px-3 py-2 text-left font-medium text-brand-med-gray">Responsável</th>
                                    <th className="px-3 py-2 text-left font-medium text-brand-med-gray">Início Prev.</th>
                                    <th className="px-3 py-2 text-left font-medium text-brand-med-gray">Fim Prev.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-darkest">
                                {importedTasks.slice(0, 10).map(task => (
                                    <tr key={task.id}>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">{task.id}</td>
                                        <td className="px-3 py-2 text-gray-300">{task.title}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">{task.assignee}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">{task.startDate}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">{task.dueDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {importedTasks.length > 10 && <p className="text-center text-xs text-brand-med-gray p-2">...e mais {importedTasks.length - 10} tarefas.</p>}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition shadow-lg shadow-green-500/20 hover:shadow-green-500/40">
                            Definir como Linha Base
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    const DisplayView = () => (
        <div className="bg-brand-dark/70 p-4 rounded-lg animate-fade-in space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="text-xl font-bold text-gray-100">Linha Base Atual</h3>
                <button
                    onClick={() => {
                        if (user.role === 'Master' || user.role === 'Planejador') {
                            setIsImporting(true);
                        } else {
                            alert('Apenas usuários Master ou Planejador podem substituir a linha de base.');
                        }
                    }}
                    className="flex items-center gap-2 bg-brand-accent text-white px-3 py-1.5 rounded-md hover:bg-orange-600 transition-colors shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 text-sm"
                >
                    <BaselineIcon className="w-4 h-4" />
                    Substituir Linha Base
                </button>
                {baselineTasks.length > 0 && (
                    <button
                        onClick={() => exportTasksToExcel(baselineTasks, `Linha_de_Base_${new Date().toISOString().split('T')[0]}`)}
                        className="flex items-center gap-2 bg-green-600/20 text-green-400 px-3 py-1.5 rounded-md hover:bg-green-600 hover:text-white transition-all duration-300 border border-green-600/30 text-sm font-bold"
                    >
                        <ExcelIcon className="w-4 h-4" />
                        Exportar Excel
                    </button>
                )}
            </div>

            <div className="bg-brand-darkest/50 rounded-lg shadow-lg border border-brand-darkest overflow-hidden">
                <table className="w-full table-auto divide-y divide-brand-darkest text-[10px] leading-tight">
                    <thead className="bg-brand-darkest/80">
                        <tr>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider w-8">ID</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Título</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Resp.</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Disc.</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Nível</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider w-16">Início</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider w-16">Fim</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Local</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Apoio</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Corte</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Qtd.</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Unid.</th>
                            <th className="px-2 py-2 text-left font-medium text-brand-med-gray uppercase tracking-wider">Progresso %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-darkest">
                        {baselineTasks.map(task => (
                            <tr key={task.id} className="hover:bg-brand-dark/50 transition-colors">
                                <td className="px-2 py-1.5 align-middle text-gray-300 font-mono">{task.id}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-100 font-semibold break-words max-w-[150px]">{task.title}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-300 break-words max-w-[80px]">{task.assignee}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 break-words max-w-[80px]">{task.discipline}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 break-words max-w-[80px]">{task.level}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-300 whitespace-nowrap">{formatDate(task.startDate)}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-300 whitespace-nowrap">{formatDate(task.dueDate)}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 break-words max-w-[80px]">{task.location}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 break-words max-w-[60px]">{task.support || '-'}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 break-words max-w-[60px]">{task.corte || '-'}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-300 text-right font-mono">{task.quantity}</td>
                                <td className="px-2 py-1.5 align-middle text-gray-400 text-center">{task.unit}</td>
                                <td className="px-2 py-1.5 align-middle text-center">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${task.progress >= 100 ? 'bg-green-500/20 text-green-400' : task.progress > 0 ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-500/20 text-gray-400'}`}>
                                        {task.progress || 0}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {baselineTasks.length === 0 && (
                    <div className="text-center py-10 text-brand-med-gray text-sm">
                        Nenhuma linha de base foi importada ainda.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="baseline"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={() => { }}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToVisualControl={onNavigateToVisualControl}
                onUpgradeClick={onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={() => { }}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                    onNavigateToVisualControl={onNavigateToVisualControl}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="baseline"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
                    <div className="max-w-screen-2xl mx-auto space-y-8">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-bold text-brand-accent">Painel da Linha Base</h2>
                                <div className="flex items-center gap-2 mt-2 bg-brand-dark/50 p-2 rounded border border-brand-darkest">
                                    <label className="text-[10px] text-brand-med-gray uppercase font-bold">Data de Corte:</label>
                                    <input
                                        type="date"
                                        value={baselineCutOffDateStr}
                                        onChange={(e) => setBaselineCutOffDateStr(e.target.value)}
                                        className="bg-brand-darkest text-white text-xs border-none rounded p-1 focus:ring-1 focus:ring-brand-accent/50"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={onNavigateToDashboard}
                                className="bg-brand-dark/80 text-brand-med-gray px-4 py-2 rounded-md hover:bg-brand-dark transition-colors"
                            >
                                &larr; Voltar ao Quadro
                            </button>
                        </div>
                        {isImporting ? <ImportView /> : <DisplayView />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default BaselinePage;