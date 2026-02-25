
/**
 * Formata um número para o padrão brasileiro (milhar com ponto, decimal com vírgula).
 */
export const formatNumberBR = (value: number | string | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null || value === '') {
        return '0' + (decimals > 0 ? ',' + '0'.repeat(decimals) : '');
    }

    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

    if (isNaN(num)) {
        return '0' + (decimals > 0 ? ',' + '0'.repeat(decimals) : '');
    }

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: num % 1 === 0 ? 0 : decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

/**
 * Formata uma data string para o padrão brasileiro DD/MM/YYYY.
 */
export const formatDateBR = (dateString: string | undefined | null): string => {
    if (!dateString) return '-';
    // Se a data vier no formato ISO ou YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Retorna original se inválido
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};
