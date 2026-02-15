
export enum TaskStatus {
  ToDo = 'A Iniciar',
  InProgress = 'Em Andamento',
  Completed = 'Concluído',
}

export interface Resource {
  role: string;
  quantity: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string; // Responsável
  discipline: string; // Disciplina (ex: Estrutura, Hidráulica)
  level: string; // Nível/Pavimento (ex: Térreo, 1º Andar)
  startDate: string; // Datas
  dueDate: string; // Datas
  actualStartDate?: string; // Início (Real)
  actualEndDate?: string; // Fim (Real)
  location: string; // Local ou Frente
  support: string; // Apoio
  corte?: string; // Campo adicional para corte
  quantity: number; // Quantidades
  unit: string; // Quantidades (unidade)
  actualQuantity?: number; // Quantidade Real
  progress: number; // Percentual de avanço (0-100)
  plannedManpower: Resource[];
  plannedMachinery: Resource[];
  actualManpower?: Resource[];
  actualMachinery?: Resource[];
  photos?: string[];
  observations?: string;
  user_id?: string; // Foreign key to auth.users
  baseline_id?: string; // Reference to baseline_tasks.id
}

export interface User {
  id: string;
  username: string;
  role: 'Master' | 'Planejador' | 'Gerenciador' | 'Executor';
  fullName?: string;
  whatsapp?: string;
  email?: string;
  avatar_url?: string;
}

// Sistema de Restrições (Lean Construction)
export enum RestrictionType {
  Material = 'Material',
  Labor = 'Mão de Obra',
  Equipment = 'Equipamento',
  Design = 'Projeto/Desenho',
  Safety = 'Segurança',
  Weather = 'Clima',
  Predecessor = 'Atividade Predecessora',
  Other = 'Outro'
}

export enum RestrictionStatus {
  Pending = 'Pendente',
  InProgress = 'Em Resolução',
  Resolved = 'Resolvida'
}

export enum RestrictionPriority {
  Critical = 'Crítica',
  High = 'Alta',
  Medium = 'Média',
  Low = 'Baixa'
}

export interface Restriction {
  id: string;
  baseline_task_id: string; // Referência à tarefa da baseline
  type: RestrictionType;
  description: string;
  status: RestrictionStatus;
  priority: RestrictionPriority;
  responsible: string; // Responsável pela remoção
  department?: string; // Setor responsável
  due_date?: string; // Data limite para conclusão
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  actual_start_date?: string; // Data real de início
  actual_completion_date?: string; // Data real de término
  user_id?: string; // Quem criou a restrição
}

// Lean Construction Interfaces
export type MacroDiscipline = 'Fabricação' | 'Obra de Arte Especial' | 'Drenagem' | 'Terraplenagem' | 'Contenções';

export interface Worker {
  role: string;
  customRole?: string;
  count: number;
}

export interface LeanSubTask {
  id: string;
  description: string;
  startTime: string;
  endTime: string;
  workers: Worker[];
  machinery: number;
  isUnproductive: boolean;
  producedQuantity?: number;
  unit?: string;
}

export interface AISuggestion {
  date: string;
  text: string;
}

export interface LeanTask {
  id: string;
  discipline: MacroDiscipline;
  service: string;
  location: string;
  date: string;
  quantity: number;
  unit: string;
  shiftStartTime: string;
  shiftEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  analysisInterval: number;
  subtasks: LeanSubTask[];
  aiSuggestions?: AISuggestion[];
}

// Módulo de Custos
export interface CostItem {
  id: string;
  category: string;
  description: string;
  plannedAmount: number;
  actualAmount: number;
  status: 'Dentro do Orçamento' | 'Crítico' | 'Excedido';
}

export interface Measurement {
  id: string;
  service: string;
  date: string;
  quantity: number;
  unit: string;
  value: number;
  responsible: string;
}

export interface CashFlowItem {
  id: string;
  date: string;
  type: 'Receita' | 'Despesa';
  category: string;
  description: string;
  value: number;
}