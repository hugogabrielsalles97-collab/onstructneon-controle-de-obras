/**
 * Leitura das propriedades que o próprio projeto grava em cada peça.
 *
 * O modelo traz, por elemento:
 *   CCR_LocalizacaoObra        EIXO_30000-S, EIXO_40000-N, ACESSO_*, ...
 *   CCR_EstaqueamentoInicial   31029+1.00
 *   CCR_EstaqueamentoFinal     31215+10.00
 *   CCR_Cod                    CAUQ, BGTC, CFT, ...
 *
 * Isso substitui toda a inferência geométrica que vinha antes. Descobrir a
 * estaca projetando pontos sobre o eixo era aproximação: errava o eixo onde as
 * pistas se aproximam e dependia do formato da peça. Aqui é o dado do
 * projetista, e a numeração já vem na mesma escala usada pelas tarefas.
 */

export interface PropriedadesPeca {
    /** 3 ou 4, conforme o eixo declarado. Nulo em acessos e marginais. */
    eixo: number | null;
    /** Estaca inicial e final, na numeração de 5 dígitos das tarefas. */
    de: number | null;
    ate: number | null;
    localizacao: string | null;
    /** Código do serviço segundo o projeto (CAUQ, BGTC, ...). */
    cod: string | null;
}

const PROPRIEDADES = [
    'CCR_LocalizacaoObra',
    'CCR_EstaqueamentoInicial',
    'CCR_EstaqueamentoFinal',
    'CCR_Cod',
];

/**
 * Extrai o eixo de uma localização como `EIXO_30000-S`.
 * Acessos, marginais e dispositivos usam estaqueamento local, que não tem
 * correspondência com as tarefas — por isso devolvem nulo.
 */
export function eixoDaLocalizacao(localizacao: string | null): number | null {
    if (!localizacao) return null;
    const m = /EIXO_(\d)0000/i.exec(localizacao);
    return m ? Number(m[1]) : null;
}

/** `31029+1.00` -> 31029. O deslocamento em metros não é usado. */
export function estacaDoTexto(texto: string | null): number | null {
    if (!texto) return null;
    const m = /(\d{4,6})\s*\+/.exec(String(texto));
    if (m) return Number(m[1]);

    const solto = /^\s*(\d{4,6})\s*$/.exec(String(texto));
    return solto ? Number(solto[1]) : null;
}

const valorDe = (props: any[], nome: string): string | null => {
    const achado = props.find(p => p.displayName === nome || p.attributeName === nome);
    if (!achado) return null;
    const valor = String(achado.displayValue ?? '').trim();
    return valor === '' || valor === '-' ? null : valor;
};

/**
 * Lê as propriedades de muitos elementos de uma vez.
 *
 * `getBulkProperties` consulta o banco de propriedades que o Viewer já tem
 * carregado, sem ida ao servidor por elemento — o que seria inviável para
 * milhares de peças.
 */
export function lerPropriedades(viewer: any, dbIds: number[]): Promise<Map<number, PropriedadesPeca>> {
    return new Promise((resolve) => {
        const model = viewer?.model;
        const mapa = new Map<number, PropriedadesPeca>();

        if (!model || typeof model.getBulkProperties !== 'function' || dbIds.length === 0) {
            resolve(mapa);
            return;
        }

        model.getBulkProperties(
            dbIds,
            { propFilter: PROPRIEDADES, ignoreHidden: true },
            (resultados: any[]) => {
                for (const r of resultados || []) {
                    const props = r.properties || [];
                    const localizacao = valorDe(props, 'CCR_LocalizacaoObra');

                    mapa.set(r.dbId, {
                        eixo: eixoDaLocalizacao(localizacao),
                        de: estacaDoTexto(valorDe(props, 'CCR_EstaqueamentoInicial')),
                        ate: estacaDoTexto(valorDe(props, 'CCR_EstaqueamentoFinal')),
                        localizacao,
                        cod: valorDe(props, 'CCR_Cod'),
                    });
                }

                resolve(mapa);
            },
            () => resolve(mapa)
        );
    });
}

/** Faixa de estacas declarada, sempre em ordem crescente. */
export function faixaDeclarada(p: PropriedadesPeca | undefined): [number, number] | null {
    if (!p || p.de === null || p.ate === null) return null;
    return p.de <= p.ate ? [p.de, p.ate] : [p.ate, p.de];
}
