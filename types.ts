
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
  role: 'Planejador' | 'Executor' | 'Visitante';
  fullName?: string;
  whatsapp?: string;
}