import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';

const WAR_ROOM_ONLY_ALIASES = new Set(['visualizador', 'visual']);

/** Perfis de gestão: nunca forçar modo TV-only por metadados de cadastro. */
const ELEVATED_PLANNING_ROLES = new Set(['master', 'planejador', 'gerenciador']);

function normKey(role: unknown): string {
  if (typeof role !== 'string') return '';
  return role.trim().toLowerCase();
}

export function isElevatedPlanningRole(role: unknown): boolean {
  return ELEVATED_PLANNING_ROLES.has(normKey(role));
}

/** Role nos metadados do Auth pedindo acesso somente War Room TV. */
export function metadataIndicatesWarRoomViewer(role: unknown): boolean {
  return WAR_ROOM_ONLY_ALIASES.has(normKey(role));
}

export function profileRoleIsWarRoomViewer(role: unknown): boolean {
  return WAR_ROOM_ONLY_ALIASES.has(normKey(role));
}

/** Valor canônico em profiles.role para o perfil TV-only. */
export function mapProfileRoleToCanonical(role: string | null | undefined): User['role'] {
  const k = normKey(role);
  if (WAR_ROOM_ONLY_ALIASES.has(k)) return 'Visualizador';
  const t = typeof role === 'string' ? role.trim() : '';
  const allowed: User['role'][] = ['Master', 'Planejador', 'Gerenciador', 'Executor', 'Visitante', 'Visualizador'];
  if (allowed.includes(t as User['role'])) return t as User['role'];
  return (t || 'Visitante') as User['role'];
}

/**
 * Conta restrita à War Room TV: Visualizador no perfil, ou cadastro (Auth) pediu Visualizador
 * e o perfil ainda está Visitante/Executor (falha de sincronismo com o banco).
 */
export function userIsWarRoomOnlyViewer(user: User | null, session: Session | null): boolean {
  const pKey = normKey(user?.role);
  if (isElevatedPlanningRole(user?.role)) return false;
  if (WAR_ROOM_ONLY_ALIASES.has(pKey)) return true;

  const mKey = normKey(session?.user?.user_metadata?.role);
  if (!WAR_ROOM_ONLY_ALIASES.has(mKey)) return false;

  return pKey === 'visitante' || pKey === 'executor' || pKey === '';
}

export function userCanAccessWarRoomTV(user: User | null, session: Session | null): boolean {
  if (userIsWarRoomOnlyViewer(user, session)) return true;
  if (user && normKey(user.role) === 'master') return true;
  return false;
}
