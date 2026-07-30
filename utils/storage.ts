/// <reference types="vite/client" />
import { supabase } from '../supabaseClient';

/**
 * Camada única de upload de fotos.
 *
 * Fotos novas vão para o Cloudflare R2, servidas pelo Worker `obras-fotos`.
 * As fotos antigas continuam apontando para o Storage do Supabase pela URL
 * absoluta já gravada em `tasks.photos` — as duas origens convivem sem
 * precisar de migração para o app funcionar.
 */

const PHOTO_BASE_URL = (import.meta.env.VITE_PHOTO_BASE_URL || '').trim().replace(/\/+$/, '');

export const isPhotoStorageConfigured = Boolean(PHOTO_BASE_URL);

if (!isPhotoStorageConfigured) {
    console.error(
        '[ELOS] VITE_PHOTO_BASE_URL não configurada: o upload de fotos vai falhar. ' +
        'Aponte para o Worker obras-fotos (ex.: https://obras-fotos.SEU-SUBDOMINIO.workers.dev).'
    );
}

/** `<timestamp>-<random>.<ext>`, o mesmo formato já usado no bucket do Supabase. */
export const buildPhotoKey = (ext: string = 'jpg'): string =>
    `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

export const photoUrlFor = (key: string): string => `${PHOTO_BASE_URL}/${key}`;

/**
 * Envia uma foto já comprimida e devolve a URL pública definitiva.
 * Lança em caso de falha — deliberadamente não há fallback para o Supabase,
 * que está acima da cota do plano gratuito.
 */
export async function uploadPhoto(blob: Blob, ext: string = 'jpg'): Promise<string> {
    if (!isPhotoStorageConfigured) {
        throw new Error('Storage de fotos não configurado (VITE_PHOTO_BASE_URL ausente).');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Sessão expirada — faça login novamente para enviar fotos.');
    }

    const key = buildPhotoKey(ext);

    const res = await fetch(photoUrlFor(key), {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': blob.type || 'image/jpeg',
        },
        body: blob,
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Falha no upload da foto (${res.status}). ${detail}`.trim());
    }

    return photoUrlFor(key);
}

/** Prefixo público das fotos que ainda estão no Storage do Supabase. */
export const SUPABASE_PHOTO_PREFIX =
    `${(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')}/storage/v1/object/public/task-photos/`;

export const isSupabaseHostedPhoto = (url: unknown): url is string =>
    typeof url === 'string' && url.startsWith(SUPABASE_PHOTO_PREFIX);

/** Extrai a chave do objeto a partir da URL pública do Supabase. */
export const keyFromSupabaseUrl = (url: string): string =>
    decodeURIComponent(url.slice(SUPABASE_PHOTO_PREFIX.length).split('?')[0]);

/**
 * Garante que a foto exista no R2 e devolve a URL nova.
 *
 * A cópia acontece servidor-a-servidor dentro do Worker: os bytes não passam
 * pelo navegador. Depois de copiar, confirma por HEAD — que consulta apenas o
 * R2, sem fallback — antes de dar a chave por migrada. Devolve `null` se algo
 * falhar, e nesse caso o chamador mantém a URL original intacta.
 */
export async function ensurePhotoInR2(key: string): Promise<string | null> {
    if (!isPhotoStorageConfigured) return null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    try {
        const copy = await fetch(`${PHOTO_BASE_URL}/_copy`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key }),
        });

        if (!copy.ok) return null;

        // Confirmação independente: o objeto responde mesmo pelo R2?
        const head = await fetch(photoUrlFor(key), { method: 'HEAD' });
        if (!head.ok || head.headers.get('X-Photo-Source') !== 'r2') return null;

        return photoUrlFor(key);
    } catch {
        return null;
    }
}
