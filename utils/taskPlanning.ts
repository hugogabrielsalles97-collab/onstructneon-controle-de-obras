import type { Task } from '../types';
import { TaskStatus } from '../types';

/** Datas âncora dos quadros (planejamento inicial — imutável após definido). */
export function getAnchorStart(task: Task): string {
  return (task.originalStartDate || task.startDate || '').trim();
}

export function getAnchorDue(task: Task): string {
  return (task.originalDueDate || task.dueDate || '').trim();
}

export function getRescheduleCount(task: Task): number {
  return task.rescheduleHistory?.length ?? 0;
}

export function isTaskOverdueByInitialPlan(task: Task, todayStartMs: number): boolean {
  const due = getAnchorDue(task);
  if (!due) return false;
  const dueMs = new Date(due + 'T00:00:00').getTime();
  if (Number.isNaN(dueMs)) return false;
  return dueMs < todayStartMs && task.status !== TaskStatus.Completed;
}

export function taskWasRescheduled(task: Task): boolean {
  return getRescheduleCount(task) > 0;
}
