/**
 * Worker `elos-aps` — ponte entre o ELOS e a Autodesk Platform Services.
 *
 * GET /token  -> devolve um token APS de escopo `viewables:read` e vida curta,
 *                só para quem tem sessão válida no ELOS.
 * GET /model  -> devolve o urn do modelo publicado, para o front não precisar
 *                ter isso embutido no bundle.
 *
 * O APS_CLIENT_SECRET fica aqui como secret do Worker e nunca chega ao
 * navegador. O token entregue ao Viewer só permite ler viewables — não dá
 * acesso a upload, tradução, nem à conta.
 */

const APS_BASE = 'https://developer.api.autodesk.com';
const VIEWER_SCOPE = 'viewables:read';

/** Margem antes do vencimento: melhor renovar cedo que servir token morto. */
const RENEW_MARGIN_MS = 5 * 60 * 1000;

function corsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

    const headers = {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };

    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return headers;
}

const json = (status, body, extra = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
    });

/**
 * Confere a sessão do usuário no Supabase.
 *
 * trim() em tudo que vira header: um secret gravado por pipe pode carregar a
 * quebra de linha do shell, e isso faz o fetch lançar — virando um 401 mudo.
 */
async function checkSupabaseUser(token, env) {
    if (!token) return { ok: false, reason: 'sem token no cabecalho Authorization' };
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        return { ok: false, reason: 'Worker sem SUPABASE_URL ou SUPABASE_ANON_KEY' };
    }

    try {
        const res = await fetch(`${env.SUPABASE_URL.trim().replace(/\/+$/, '')}/auth/v1/user`, {
            headers: {
                Authorization: `Bearer ${token.trim()}`,
                apikey: env.SUPABASE_ANON_KEY.trim(),
            },
        });

        if (res.ok) return { ok: true };

        const body = await res.text().catch(() => '');
        let msg = body.slice(0, 200);
        try { const j = JSON.parse(body); msg = j.msg || j.message || msg; } catch { /* texto cru */ }

        return { ok: false, reason: `supabase respondeu ${res.status}: ${msg}` };
    } catch (err) {
        return { ok: false, reason: `erro ao falar com o supabase: ${err.message}` };
    }
}

/**
 * Token de aplicação da APS, reaproveitado enquanto for válido.
 *
 * O cache importa: a APS responde 403 "capacity exceeded" sob rajada, com
 * janela de minutos. Sem isso, uma sala com várias pessoas abrindo o modelo
 * derrubaria a emissão de token para todo mundo.
 */
let cachedToken = { value: null, expiresAt: 0 };

async function getApsToken(env) {
    if (cachedToken.value && Date.now() < cachedToken.expiresAt - RENEW_MARGIN_MS) {
        return { token: cachedToken.value, expiresIn: Math.floor((cachedToken.expiresAt - Date.now()) / 1000) };
    }

    const id = (env.APS_CLIENT_ID || '').trim();
    const secret = (env.APS_CLIENT_SECRET || '').trim();
    if (!id || !secret) throw new Error('Worker sem APS_CLIENT_ID ou APS_CLIENT_SECRET');

    const res = await fetch(`${APS_BASE}/authentication/v2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: VIEWER_SCOPE }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`APS ${res.status}: ${body.error_description || body.error || 'falha ao obter token'}`);
    }

    cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return { token: body.access_token, expiresIn: body.expires_in };
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
        if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' }, cors);

        if (url.pathname === '/' ) return json(200, { ok: true, service: 'elos-aps' }, cors);

        // Toda rota abaixo exige usuário logado no ELOS.
        const auth = request.headers.get('Authorization') || '';
        const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        const session = await checkSupabaseUser(bearer, env);

        if (!session.ok) return json(401, { error: 'Não autorizado.', motivo: session.reason }, cors);

        if (url.pathname === '/model') {
            const urn = (env.MODEL_URN || '').trim();
            if (!urn) return json(404, { error: 'Nenhum modelo publicado.' }, cors);
            return json(200, { urn, nome: (env.MODEL_NAME || '').trim() || null }, cors);
        }

        if (url.pathname === '/token') {
            try {
                const { token, expiresIn } = await getApsToken(env);
                return json(200, { access_token: token, expires_in: expiresIn }, cors);
            } catch (err) {
                return json(502, { error: 'Falha ao obter token da Autodesk.', motivo: err.message }, cors);
            }
        }

        return json(404, { error: 'Rota desconhecida.' }, cors);
    },
};
