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

export function limparPintura(viewer: any) {
    viewer?.clearThemingColors?.(viewer.model);
    viewer?.impl?.invalidate(true);
}
