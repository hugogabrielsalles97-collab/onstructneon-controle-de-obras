export const disciplineOptions: Record<string, string[]> = {
    'Obras de arte especiais': ['Fundação', 'Mesoestrutura', 'Superestrutura'],
    'Terraplenagem': ['Corte de 1ª e 2ª Cat', 'Corte de 3ª Cat', 'Aterro'],
    'Contenções': ['Solo Grampeado', 'Cortina Atirantada', 'Biomanta / Geomanta'],
    'Pavimentação': ['Pavimentação'],
    'Drenagem': ['Drenagem superficial', 'Drenagem profuna']
};

export const taskTitleOptions: Record<string, Record<string, string[]>> = {
    'Obras de arte especiais': {
        'Fundação': ['Estaca Raiz', 'Escavação do bloco', 'Arrasamento das estacas', 'Concreto magro', 'Ensaio de PIT', 'Armação do bloco', 'Forma do bloco', 'Concreto magro', 'Desforma do bloco', 'Reaterro do bloco', 'Apicoamento do bloco'],
        'Mesoestrutura': ['Andaime pilar 1° Etapa', 'Andaime pilar 2° Etapa', 'Andaime pilar 3° Etapa', 'Andaime pilar 4° Etapa', 'Andaime pilar 5° Etapa', 'Andaime pilar 6° Etapa', 'Andaime pilar 7° Etapa', 'Andaime pilar 8° Etapa', 'Andaime pilar 9° Etapa', 'Andaime pilar 10° Etapa', 'Armação pilar 1° Etapa', 'Armação pilar 2° Etapa', 'Armação pilar 3° Etapa', 'Armação pilar 4° Etapa', 'Armação pilar 5° Etapa', 'Armação pilar 6° Etapa', 'Armação pilar 7° Etapa', 'Armação pilar 8° Etapa', 'Armação pilar 9° Etapa', 'Armação pilar 10° Etapa', 'Forma pilar 1° Etapa', 'Forma pilar 2° Etapa', 'Forma pilar 3° Etapa', 'Forma pilar 4° Etapa', 'Forma pilar 5° Etapa', 'Forma pilar 6° Etapa', 'Forma pilar 7° Etapa', 'Forma pilar 8° Etapa', 'Forma pilar 9° Etapa', 'Forma pilar 10° Etapa', 'Concreto pilar 1° Etapa', 'Concreto pilar 2° Etapa', 'Concreto pilar 3° Etapa', 'Concreto pilar 4° Etapa', 'Concreto pilar 5° Etapa', 'Concreto pilar 6° Etapa', 'Concreto pilar 7° Etapa', 'Concreto pilar 8° Etapa', 'Concreto pilar 9° Etapa', 'Concreto pilar 10° Etapa', 'Forma deslizante', 'Desforma pilar', 'Retirada do Andaime pilar', 'Cimbramento da travessa', 'Forma de fundo da travessa', 'Armação 1° etapa da travessa', 'Armação 2° etapa da travessa', 'Armação 1° e 2° etapa da travessa', 'Forma lateral 1° etapa da travessa', 'Forma lateral 2° etapa da travessa', 'Forma lateral 1° e 2° etapa da travessa', 'Concreto 1° etapa da travessa', 'Concreto 2° etapa da travessa', 'Concreto 1° e 2° etapa da travessa', 'Desforma da travessa', 'Retirada do cimbramento da travessa'],
        'Superestrutura': ['Andaime do pilarete', 'Armação do pilarete', 'Forma do pilarete', 'Concreto do pilarete', 'Lançamento de vigas', 'Armação da transversina', 'Forma da transversina', 'Concreto da transversina', 'Desforma da transversina', 'Montagem de prélaje', 'Cimbramento da laje elástica', 'Armação da laje', 'Forma da laje', 'Concreto da laje', 'Armação da laje elástica', 'Forma da laje elástica', 'Concreto da laje elástica', 'Armação laje de transição', 'Forma laje de transição', 'Concreto laje de transição', 'Armação de New Jersey', 'Concreto New Jersey', 'Montagem Placa GR'],
    },
    'Pavimentação': {
        'Pavimentação': ['Regularização de subleito', 'Execução de macadame', 'Execução de BGTC', 'Pintura de cura', 'Execução de BGMC', 'Execução de CBUQ 1° Camada', 'Execução de CBUQ 2° Camada', 'Pintura de ligação', 'Junta de dilatação'],
    },
};

export const oaeLocations = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S25', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24'];
export const frentes = ['FT01A', 'FT01B', 'FT02', 'FT03A', 'FT03B', 'FT03C', 'FT04', 'FT05', 'FT06', 'FT07', 'FT08', 'FT09', 'FT10', 'FT11', 'FT12', 'FT13', 'FT14', 'FT15', 'FT16', 'FT17', 'FT18', 'FT19', 'FT20', 'FT21', 'FT22', 'FT23', 'FT24', 'FT25', 'FT26', 'FT27', 'FT28A', 'FT28B', 'FT29', 'FT30', 'FT32', 'FT32A', 'FT32B', 'FT33', 'FT34'];
export const apoios = ['E1', 'P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'E2'];
export const vaos = ['E1-P0', 'E1-P1', 'P0-P1', 'P1-P2', 'P2-P3', 'P3-P4', 'P4-P5', 'P5-P6', 'P6-P7', 'P7-P8', 'P8-P9', 'P9-P10', 'P10-E2', 'P9-E2', 'P8-E2', 'P7-E2', 'P6-E2', 'P5-E2', 'P4-E2', 'P3-E2', 'P2-E2', 'E1-P1'];
export const unitOptions = ['un', 'm', 'm²', 'm³', 'kg', 't'];
