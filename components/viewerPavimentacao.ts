/**
 * Pintura das camadas de pavimentação por serviço.
 *
 * O arquivo I2 do federado já separa o pavimento por material, e cada camada
 * corresponde a um serviço do ELOS. Aqui cada uma ganha sua cor, para dar
 * leitura imediata de qual serviço cobre qual trecho.
 */

export interface ServicoPavimentacao {
    servico: string;
    /** Nomes possíveis da camada no CAD — a nomenclatura varia entre projetos. */
    apelidos: string[];
    cor: string;
    rgb: [number, number, number];
}

export const SERVICOS_PAVIMENTACAO: ServicoPavimentacao[] = [
    { servico: 'CFT',      apelidos: ['CFT'],                       cor: '#8B5A2B', rgb: [0.545, 0.353, 0.169] },
    { servico: 'Macadame', apelidos: ['M_SECO', 'MACADAME'],        cor: '#FACC15', rgb: [0.980, 0.800, 0.082] },
    { servico: 'BGTC',     apelidos: ['BGTC'],                      cor: '#2563EB', rgb: [0.145, 0.388, 0.922] },
    { servico: 'BGMC',     apelidos: ['BGMC'],                      cor: '#EC4899', rgb: [0.925, 0.282, 0.600] },
    { servico: 'CBUQ',     apelidos: ['CAUQ', 'CBUQ'],              cor: '#22C55E', rgb: [0.133, 0.773, 0.369] },
];

const normalizar = (nome: string) => nome.trim().toUpperCase();

export function servicoDaCamada(nomeCamada: string): ServicoPavimentacao | null {
    const alvo = normalizar(nomeCamada);
    return SERVICOS_PAVIMENTACAO.find(s => s.apelidos.some(a => normalizar(a) === alvo)) || null;
}

/** Junta as folhas de uma subárvore: o theming da Autodesk pinta por elemento. */
function folhasDe(tree: any, raiz: number): number[] {
    const folhas: number[] = [];

    tree.enumNodeChildren(
        raiz,
        (id: number) => {
            let temFilho = false;
            tree.enumNodeChildren(id, () => { temFilho = true; }, false);
            if (!temFilho) folhas.push(id);
        },
        true
    );

    return folhas;
}

/**
 * Pinta cada camada de pavimentação com a cor do seu serviço.
 * Devolve quantos elementos foram pintados por serviço.
 */
export function pintarPavimentacao(viewer: any): Record<string, number> {
    const tree = viewer?.model?.getInstanceTree?.();
    const THREE = (window as any).THREE;
    if (!tree || !THREE) return {};

    const contagem: Record<string, number> = {};

    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';
        const servico = servicoDaCamada(nome);

        if (servico) {
            const cor = new THREE.Vector4(...servico.rgb, 1);
            const folhas = folhasDe(tree, id);
            for (const folha of folhas) viewer.setThemingColor(folha, cor, viewer.model, true);
            contagem[servico.servico] = (contagem[servico.servico] || 0) + folhas.length;
            return; // não desce mais: a camada inteira já foi pintada
        }

        tree.enumNodeChildren(id, visitar, false);
    };

    visitar(tree.getRootId());
    viewer.impl.invalidate(true);

    return contagem;
}

export function limparPintura(viewer: any) {
    viewer?.clearThemingColors?.(viewer.model);
    viewer?.impl?.invalidate(true);
}
