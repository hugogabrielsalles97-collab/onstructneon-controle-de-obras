/**
 * Cliente mínimo da Autodesk Platform Services.
 *
 * Autenticação 2-legged (client credentials): os scripts falam com a APS em
 * nome da própria aplicação, sem usuário final. O secret nunca sai daqui —
 * o navegador recebe no máximo um token de leitura de curta duração.
 */

const BASE = 'https://developer.api.autodesk.com';

export const CLIENT_ID = (process.env.APS_CLIENT_ID || '').trim();
export const CLIENT_SECRET = (process.env.APS_CLIENT_SECRET || '').trim();

/** US ou EMEA — precisa bater com a região do bucket. */
export const REGION = (process.env.APS_REGION || 'US').trim().toUpperCase();

export const BUCKET_KEY = (process.env.APS_BUCKET || `elos-modelos-${CLIENT_ID.slice(0, 12).toLowerCase()}`).trim();

export function requireCredentials() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('Faltam APS_CLIENT_ID e/ou APS_CLIENT_SECRET no .env. Abortando.');
        process.exit(1);
    }
}

let cached = { token: null, expiresAt: 0 };

/**
 * Token de aplicação. Fica em cache até perto de expirar, porque um upload
 * em partes de centenas de MB pode durar mais que a validade do token.
 */
export async function getToken(scopes = 'data:read data:write data:create bucket:create bucket:read') {
    if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;

    const res = await fetch(`${BASE}/authentication/v2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: scopes }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(`Autenticação falhou (${res.status}): ${body.error_description || body.error || JSON.stringify(body)}`);
    }

    cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cached.token;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Chamada autenticada à API, com tratamento de erro legível e nova tentativa.
 *
 * A APS devolve 403 "API request capacity exceeded" como limite de taxa, não
 * como cota esgotada — some sozinho depois de alguns segundos. Sem recuo aqui,
 * uma rajada derruba a chamada que fecha um upload de centenas de MB.
 */
export async function api(path, { method = 'GET', headers = {}, body, scopes, attempts = 9 } = {}) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    let lastError;

    for (let i = 0; i < attempts; i++) {
        const token = await getToken(scopes);

        let res;
        try {
            res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
        } catch (err) {
            lastError = new Error(`${method} ${path} -> rede: ${err.message}`);
            await sleep(2000 * 2 ** i);
            continue;
        }

        const text = await res.text();
        let parsed;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

        if (res.ok) return parsed;

        const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        lastError = new Error(`${method} ${path} -> ${res.status}: ${detail}`);

        const isCapacity = res.status === 403 && /capacity exceeded/i.test(detail);
        const retryable = isCapacity || res.status === 429 || res.status >= 500;
        if (!retryable) throw lastError;

        // A janela de "capacity exceeded" é de minutos, não de segundos —
        // medido na prática: 48s de recuo não bastavam, ~10min destravaram.
        const fallback = isCapacity ? Math.min(30_000 * 2 ** i, 300_000) : 3_000 * 2 ** i;
        const wait = Number(res.headers.get('Retry-After') || 0) * 1000 || fallback;
        console.log(`  aguardando ${Math.round(wait / 1000)}s (${res.status}) e tentando de novo...`);
        await sleep(wait);
    }

    throw lastError;
}

/** URN em base64 url-safe, como o Model Derivative espera. */
export const toUrn = (objectId) =>
    Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Executado diretamente: confere as credenciais.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
    requireCredentials();
    getToken()
        .then(t => {
            console.log('Autenticação OK.');
            console.log(`  client id : ${CLIENT_ID.slice(0, 8)}...${CLIENT_ID.slice(-4)} (${CLIENT_ID.length} chars)`);
            console.log(`  token     : ${t.slice(0, 12)}... (${t.length} chars)`);
            console.log(`  regiao    : ${REGION}`);
            console.log(`  bucket    : ${BUCKET_KEY}`);
        })
        .catch(err => { console.error(err.message); process.exitCode = 1; });
}
