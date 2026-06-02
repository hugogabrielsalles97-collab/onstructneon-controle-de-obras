import { OrgMember } from '../types';

// ==========================================
// Mapeamento de Engenheiro responsável por tarefa.
// Fonte única usada pelo Dashboard (Programação Semanal) e pelo
// Painel Gerencial (filtros de PPC), para que a lista de engenheiros
// e a associação tarefa→engenheiro nunca divirjam entre as telas.
// ==========================================

// Normalização de nomes — unifica duplicatas no organograma.
// Se o banco tem "Rafael Arouca" mas o correto é "Rafael Requiao", mapeia aqui.
const NAME_NORMALIZATION_MAP: Record<string, string> = {
  'Rafael Arouca': 'Rafael Requiao',
};

/** Remove acentos e caracteres especiais para comparações robustas. */
export const normalizeString = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export const normalizeName = (name: string): string => NAME_NORMALIZATION_MAP[name] || name;

// Mapeamento OAE (localização) → Engenheiro.
export const OAE_ENGINEER_MAP: Record<string, string> = {
  'S01': 'Bruno Bastos', 'S02': 'Bruno Bastos', 'S03': 'Bruno Bastos',
  'S04': 'Bruno Bastos', 'S05': 'Bruno Bastos', 'S06': 'Bruno Bastos',
  'S07': 'Bruno Bastos', 'S08': 'Bruno Bastos', 'S09': 'Bruno Bastos',
  'S10': 'Matheus Ramos', 'S11': 'Matheus Ramos', 'S12': 'Matheus Ramos',
  'S13': 'Rafael Requiao', 'S14': 'Rafael Requiao',
  'D15': 'Bruno Bastos', 'D16': 'Bruno Bastos', 'D17': 'Bruno Bastos', 'D18': 'Bruno Bastos',
  'D19': 'Matheus Ramos', 'D20': 'Matheus Ramos', 'D21': 'Matheus Ramos',
  'D22': 'Rafael Requiao', 'D23': 'Rafael Requiao', 'D24': 'Rafael Requiao',
  'QUADRATUM': 'Bruno Bastos',
  'PÁTIO DE VIGAS': 'Matheus Ramos',
};

// Engenheiros cuja associação vem da árvore do organograma (não da OAE).
// SOMENTE estes usam a lógica de descendência; os demais usam OAE_ENGINEER_MAP por localização.
export const TREE_BASED_ENGINEERS = ['rodrigo marota'];

export const getEngineerForLocation = (location: string | undefined): string | null => {
  if (!location) return null;
  const loc = location.toUpperCase().trim();
  for (const [oaeLabel, engineer] of Object.entries(OAE_ENGINEER_MAP)) {
    if (loc.includes(oaeLabel)) return engineer;
  }
  return null;
};

// Nível "Pátio de Pré Moldados" é fabricado no pátio (fora da OAE) e sempre
// responde ao Matheus Ramos, independente da OAE de destino da peça.
export const isPatioPreMoldadosLevel = (level: string | undefined): boolean => {
  if (!level) return false;
  const norm = normalizeString(level);
  return norm.includes('patio') && norm.includes('pre') && norm.includes('moldad');
};

/**
 * Mapeia cada engenheiro baseado em árvore (TREE_BASED_ENGINEERS) para o conjunto
 * de nomes (normalizados) de todos os seus descendentes no organograma — incluindo
 * o próprio. Usado para associar tarefas pelo responsável (assignee).
 */
export const buildEngineerDescendants = (orgMembers: OrgMember[]): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>();
  if (!orgMembers || orgMembers.length === 0) return result;

  const treeEngineers = orgMembers.filter(m =>
    TREE_BASED_ENGINEERS.includes(normalizeString(normalizeName(m.name || '')))
  );

  treeEngineers.forEach(eng => {
    const finalEngName = normalizeName(eng.name || '').trim();
    if (!finalEngName) return;

    const descendants = new Set<string>();
    // Próprio gestor: tarefas com ele como responsável também entram no filtro dele
    descendants.add(normalizeString(normalizeName(eng.name || '')));

    const findDescendants = (parentId: string) => {
      const children = orgMembers.filter(m => m.parent_id === parentId);
      children.forEach(child => {
        if (child.name) descendants.add(normalizeString(normalizeName(child.name)));
        findDescendants(child.id);
      });
    };

    findDescendants(eng.id);
    result.set(finalEngName, descendants);
  });

  return result;
};

/** Nomes dos engenheiros baseados em árvore, exibidos sempre no filtro mesmo sem tarefa associada. */
export const getTreeEngineerLabels = (orgMembers: OrgMember[]): string[] => {
  if (!orgMembers) return [];
  return orgMembers
    .filter(m => TREE_BASED_ENGINEERS.includes(normalizeString(normalizeName(m.name || ''))))
    .map(m => normalizeName(m.name || '').trim())
    .filter(Boolean);
};

/** Retorna a lista de engenheiros associados a uma tarefa (pode ser mais de um). */
export const getEngineersForTask = (
  task: { location?: string; assignee?: string; level?: string },
  descendantsMap: Map<string, Set<string>>
): string[] => {
  const result: string[] = [];

  // 0. Override: nível Pátio de Pré Moldados → sempre Matheus Ramos
  if (isPatioPreMoldadosLevel(task.level)) {
    result.push('Matheus Ramos');
  } else {
    // 1. Por localização (OAE)
    const locEng = getEngineerForLocation(task.location);
    if (locEng) result.push(locEng);
  }

  // 2. Por árvore do organograma
  if (task.assignee) {
    const assigneeKey = normalizeString(normalizeName(task.assignee));
    descendantsMap.forEach((descendants, engName) => {
      if (descendants.has(assigneeKey)) result.push(engName);
    });
  }

  return result;
};
