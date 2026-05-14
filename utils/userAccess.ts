import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';

const WAR_ROOM_ONLY_ALIASES = new Set(['visualizador', 'visual']);

function normKey(role: unknown): string {
  if (typeof role !== 'string') return '';
  return role.trim().toLowerCase();
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
 * Conta restrita à War Room TV: papel Visualizador no perfil (ou alias) ou,
 * enquanto o perfil ainda está Visitante, o cadastro já registrou Visualizador nos metadados do Auth.
 */
export function userIsWarRoomOnlyViewer(user: User | null, session: Session | null): boolean {
  const pKey = normKey(user?.role);
  if (WAR_ROOM_ONLY_ALIASES.has(pKey)) return true;

  const mKey = normKey(session?.user?.user_metadata?.role);
  if (!WAR_ROOM_ONLY_ALIASES.has(mKey)) return false;

  if (pKey && pKey !== 'visitante' && !WAR_ROOM_ONLY_ALIASES.has(pKey)) return false;

  return true;
}

export function userCanAccessWarRoomTV(user: User | null, session: Session | null): boolean {
  if (userIsWarRoomOnlyViewer(user, session)) return true;
  if (user && normKey(user.role) === 'master') return true;
  return false;
}
