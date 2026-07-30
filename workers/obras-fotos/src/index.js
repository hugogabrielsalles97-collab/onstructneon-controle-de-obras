/**
 * Worker `obras-fotos` — serve e recebe as fotos de tarefa guardadas no R2.
 *
 * GET   /<chave>  -> devolve a imagem. Se ainda não estiver no R2, busca no
 *                    Storage do Supabase, entrega normalmente e copia para o
 *                    R2 em segundo plano. É o que garante que nenhuma imagem
 *                    quebre durante a transição.
 * HEAD  /<chave>  -> checa SOMENTE o R2, sem fallback. É a verificação usada
 *                    antes de apagar qualquer original — por isso não pode
 *                    mentir dizendo que existe algo que só está no Supabase.
 * PUT   /<chave>  -> grava a imagem (upload novo, vindo do app).
 * POST  /_copy    -> força a cópia Supabase -> R2 de uma chave, sem passar
 *                    bytes pelo navegador. Usado pela migração.
 *
 * O binding do R2 dispensa chave de acesso: nem o app nem o Worker guardam
 * credencial do bucket.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SUPABASE_BUCKET = 'task-photos';

/** Chaves são geradas por nós (`<timestamp>-<random>.jpg`); nada de path traversal. */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

function corsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    const headers = {
        'Access-Control-Allow-Methods': 'GET, PUT, POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Migration-Token',
        'Access-Control-Expose-Headers': 'X-Photo-Source',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };

    if (allowed.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    } else if (allowed.length === 0) {
        // Sem lista configurada: libera leitura, mas escrita continua exigindo token.
        headers['Access-Control-Allow-Origin'] = '*';
    }

    return headers;
}

function json(status, body, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
    });
}

const supabaseObjectUrl = (env, key) =>
    `${(env.SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`;

/**
 * Valida o token do usuário contra o próprio Supabase.
 * Vale para chaves JWT simétricas e assimétricas — não precisamos
 * espelhar o segredo de assinatura aqui.
 */
async function isValidSupabaseUser(token, env) {
    if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

    try {
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: env.SUPABASE_ANON_KEY,
            },
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function authorizeWrite(request, env) {
    // trim() nos dois lados: o valor gravado como secret pode carregar a quebra
    // de linha do shell que o enviou por stdin.
    const migrationToken = (request.headers.get('X-Migration-Token') || '').trim();
    const expectedToken = (env.MIGRATION_TOKEN || '').trim();
    if (migrationToken && expectedToken && migrationToken === expectedToken) {
        return true;
    }

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return isValidSupabaseUser(token, env);
}

/**
 * Copia um objeto do Storage do Supabase para o R2.
 * Devolve `false` se o original não existe mais lá.
 */
async function copyFromSupabase(env, key) {
    const res = await fetch(supabaseObjectUrl(env, key));

    // Distingue "não existe" de "deu erro agora" — um 429 ou 5xx do Supabase
    // é transitório e merece nova tentativa, ao contrário de um 404.
    if (!res.ok) return { error: true, upstreamStatus: res.status, retryable: res.status !== 404 };

    const contentType = (res.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
        return { error: true, upstreamStatus: 200, retryable: true, reason: 'corpo vazio' };
    }

    await env.BUCKET.put(key, buffer, {
        httpMetadata: { contentType, cacheControl: IMMUTABLE_CACHE },
    });

    return { buffer, contentType };
}

export default {
    async fetch(request, env, ctx) {
        const cors = corsHeaders(request, env);
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        // --- Cópia forçada Supabase -> R2 (migração)
        if (request.method === 'POST' && url.pathname === '/_copy') {
            if (!(await authorizeWrite(request, env))) {
                return json(401, { error: 'Não autorizado.' }, cors);
            }

            const { key } = await request.json().catch(() => ({}));
            if (!key || !KEY_PATTERN.test(key)) {
                return json(400, { error: 'Chave inválida.' }, cors);
            }

            const existing = await env.BUCKET.head(key);
            if (existing) {
                return json(200, { ok: true, key, status: 'já estava no R2', size: existing.size }, cors);
            }

            const copied = await copyFromSupabase(env, key);
            if (copied.error) {
                return json(copied.retryable ? 502 : 404, {
                    error: copied.retryable
                        ? 'Falha temporária ao ler o original no Supabase.'
                        : 'Original não encontrado no Supabase.',
                    key,
                    upstreamStatus: copied.upstreamStatus,
                    reason: copied.reason,
                    retryable: copied.retryable,
                }, cors);
            }

            return json(200, { ok: true, key, status: 'copiado', size: copied.buffer.byteLength }, cors);
        }

        const key = decodeURIComponent(url.pathname.slice(1));

        if (!key) {
            return json(200, { ok: true, service: 'obras-fotos' }, cors);
        }

        if (!KEY_PATTERN.test(key)) {
            return json(400, { error: 'Chave inválida.' }, cors);
        }

        // --- HEAD: verificação estrita, só R2. Sem fallback, de propósito.
        if (request.method === 'HEAD') {
            const object = await env.BUCKET.head(key);
            if (!object) {
                return new Response(null, { status: 404, headers: cors });
            }

            const headers = new Headers(cors);
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Content-Length', String(object.size));
            headers.set('X-Photo-Source', 'r2');
            return new Response(null, { status: 200, headers });
        }

        if (request.method === 'GET') {
            const object = await env.BUCKET.get(key);

            if (object) {
                const headers = new Headers(cors);
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                headers.set('Cache-Control', IMMUTABLE_CACHE);
                headers.set('X-Photo-Source', 'r2');
                return new Response(object.body, { status: 200, headers });
            }

            // Ainda não migrada: entrega do Supabase e copia por baixo.
            const upstream = await fetch(supabaseObjectUrl(env, key));
            if (!upstream.ok) {
                return json(404, { error: 'Foto não encontrada.' }, cors);
            }

            const contentType = (upstream.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
            const buffer = await upstream.arrayBuffer();

            ctx.waitUntil(
                env.BUCKET.put(key, buffer, {
                    httpMetadata: { contentType, cacheControl: IMMUTABLE_CACHE },
                }).catch(() => { /* a próxima leitura tenta de novo */ })
            );

            const headers = new Headers(cors);
            headers.set('Content-Type', contentType);
            headers.set('Cache-Control', IMMUTABLE_CACHE);
            headers.set('X-Photo-Source', 'supabase-fallback');
            return new Response(buffer, { status: 200, headers });
        }

        if (request.method === 'PUT') {
            if (!(await authorizeWrite(request, env))) {
                return json(401, { error: 'Não autorizado.' }, cors);
            }

            const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim();
            if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
                return json(415, { error: `Tipo não aceito: ${contentType || 'desconhecido'}` }, cors);
            }

            const declaredSize = Number(request.headers.get('Content-Length') || 0);
            if (declaredSize > MAX_UPLOAD_BYTES) {
                return json(413, { error: 'Arquivo acima de 10 MB.' }, cors);
            }

            // Lê para um buffer: garante o limite mesmo sem Content-Length
            // e permite responder o tamanho real gravado.
            const body = await request.arrayBuffer();
            if (body.byteLength > MAX_UPLOAD_BYTES) {
                return json(413, { error: 'Arquivo acima de 10 MB.' }, cors);
            }

            await env.BUCKET.put(key, body, {
                httpMetadata: { contentType, cacheControl: IMMUTABLE_CACHE },
            });

            return json(200, { ok: true, key, size: body.byteLength }, cors);
        }

        return json(405, { error: 'Método não permitido.' }, cors);
    },
};
