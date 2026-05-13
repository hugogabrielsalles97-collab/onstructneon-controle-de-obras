import type { Task } from '../types';
import { TaskStatus } from '../types';

/** Baseline ligada à tarefa de execução (`baseline_id`) ou, legado, mesma `id`. */
export function resolveBaselineTask(task: Task, baselineById: Map<string, Task>): Task | null {
  if (task.baseline_id) {
    const b = baselineById.get(String(task.baseline_id));
    if (b) return b;
  }
  return baselineById.get(String(task.id)) ?? null;
}

/**
 * Âncora de quadros / prazo inicial: `original*` persistido, senão datas da baseline vinculada, senão o prazo da tarefa.
 */
export function getAnchorStart(task: Task, baselineLinked?: Task | null): string {
  const o = (task.originalStartDate || '').trim();
  if (o) return o;
  if (baselineLinked) {
    const b = (baselineLinked.originalStartDate || baselineLinked.startDate || '').trim();
    if (b) return b;
  }
  return (task.startDate || '').trim();
}

export function getAnchorDue(task: Task, baselineLinked?: Task | null): string {
  const o = (task.originalDueDate || '').trim();
  if (o) return o;
  if (baselineLinked) {
    const b = (baselineLinked.originalDueDate || baselineLinked.dueDate || '').trim();
    if (b) return b;
  }
  return (task.dueDate || '').trim();
}

export function getRescheduleCount(task: Task): number {
  return task.rescheduleHistory?.length ?? 0;
}

export function isTaskOverdueByInitialPlan(task: Task, todayStartMs: number, baselineLinked?: Task | null): boolean {
  const due = getAnchorDue(task, baselineLinked);
  if (!due) return false;
  const dueMs = new Date(due + 'T00:00:00').getTime();
  if (Number.isNaN(dueMs)) return false;
  return dueMs < todayStartMs && task.status !== TaskStatus.Completed;
}

/**
 * Prazo vigente (start/due) é diferente do plano inicial usado na lista (original → baseline → fallback).
 * A coluna Reprog. e o filtro “reprogramadas” usam só isto — histórico sozinho não basta (evita duplicar a mesma data).
 */
export function taskCurrentDiffersFromInitialPlan(task: Task, baselineLinked?: Task | null): boolean {
  const iniS = getAnchorStart(task, baselineLinked);
  const iniD = getAnchorDue(task, baselineLinked);
  const curS = (task.startDate || '').trim();
  const curD = (task.dueDate || '').trim();
  if (!curS || !curD) return false;
  if (!iniS || !iniD) return false;
  return curS !== iniS || curD !== iniD;
}

export function taskShowsReplannedColumn(task: Task, baselineLinked?: Task | null): boolean {
  return taskCurrentDiffersFromInitialPlan(task, baselineLinked);
}

export function taskWasRescheduled(task: Task): boolean {
  return getRescheduleCount(task) > 0;
}

/**
 * Histórico: cada item = prazo que foi substituído ao replanejar (não o prazo novo).
 * A lista/modal usam isso como trilha de auditoria; o prazo vigente continua em startDate/dueDate.
 */
export function getRescheduleHistoryForDisplay(task: Task, _baselineLinked?: Task | null): NonNullable<Task['rescheduleHistory']> {
  return task.rescheduleHistory ?? [];
}
