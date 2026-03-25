/**
 * Centralized AI Helper — Routes all Gemini API calls through Supabase proxy
 * with a 120-second timeout to handle large prompts (e.g., RDO generation).
 *
 * Why: Corporate firewall blocks direct calls to googleapis.com.
 * The Supabase DB proxy (gemini_proxy function) tunnels the request.
 * supabase.rpc() has a short default timeout (~8s), so we use direct fetch.
 */

const TIMEOUT_MS = 120_000; // 2 minutes

export async function callGeminiProxy(prompt: string, model = 'gemini-2.5-flash'): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY?.trim() || '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

    if (!apiKey) throw new Error('API Key do Gemini não configurada.');
    if (!supabaseUrl) throw new Error('Supabase URL não configurada.');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/gemini_proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                request_url: geminiUrl,
                request_body: requestBody,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Proxy retornou ${resp.status}: ${errText}`);
        }

        const data = await resp.json();

        if (data?.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }

        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('A IA demorou demais para responder. Tente novamente.');
        }
        throw err;
    }
}

/**
 * Variant for multimodal content (e.g., image analysis).
 * Sends parts array directly.
 */
export async function callGeminiProxyMultimodal(
    parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>,
    model = 'gemini-2.5-flash'
): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY?.trim() || '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

    if (!apiKey) throw new Error('API Key do Gemini não configurada.');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = JSON.stringify({ contents: [{ parts }] });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/gemini_proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                request_url: geminiUrl,
                request_body: requestBody,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Proxy retornou ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('A IA demorou demais para responder. Tente novamente.');
        }
        throw err;
    }
}
