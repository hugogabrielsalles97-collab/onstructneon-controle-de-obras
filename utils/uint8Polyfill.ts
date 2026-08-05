/**
 * Polyfill dos métodos hex/base64 do Uint8Array (proposta TC39 "Uint8Array to/from base64/hex").
 *
 * Por quê: o pdf.js 5.x usa `Uint8Array.prototype.toHex()` (no worker) e
 * `toBase64()/fromBase64()` (na thread principal) sem fallback. Esses métodos só
 * chegaram ao V8/Chrome 140+. Em navegadores mais antigos — comuns em tablets e
 * celulares de obra — o PDF do Visual Equipes quebra com "a.toHex is not a function".
 *
 * Este módulo instala implementações equivalentes SOMENTE quando o método nativo
 * não existe, então é inofensivo em navegadores modernos. Precisa ser importado
 * tanto na página quanto DENTRO do worker (escopos globais separados).
 */

type HexAlphabet = { alphabet?: 'base64' | 'base64url' };

function define(target: any, name: string, value: Function): void {
    if (typeof target[name] !== 'function') {
        Object.defineProperty(target, name, {
            value,
            writable: true,
            enumerable: false,
            configurable: true,
        });
    }
}

// ── toHex (instância) ───────────────────────────────────────────────
define(Uint8Array.prototype, 'toHex', function toHex(this: Uint8Array): string {
    let out = '';
    for (let i = 0; i < this.length; i++) {
        out += this[i].toString(16).padStart(2, '0');
    }
    return out;
});

// ── fromHex (estática) ──────────────────────────────────────────────
define(Uint8Array, 'fromHex', function fromHex(hex: string): Uint8Array {
    if (typeof hex !== 'string' || hex.length % 2 !== 0) {
        throw new SyntaxError('Invalid hex string');
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        const byte = parseInt(hex.substr(i * 2, 2), 16);
        if (Number.isNaN(byte)) throw new SyntaxError('Invalid hex string');
        out[i] = byte;
    }
    return out;
});

// ── toBase64 (instância) ────────────────────────────────────────────
define(Uint8Array.prototype, 'toBase64', function toBase64(this: Uint8Array, opts?: HexAlphabet): string {
    let bin = '';
    for (let i = 0; i < this.length; i++) {
        bin += String.fromCharCode(this[i]);
    }
    let b64 = btoa(bin);
    if (opts?.alphabet === 'base64url') {
        b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return b64;
});

// ── fromBase64 (estática) ───────────────────────────────────────────
define(Uint8Array, 'fromBase64', function fromBase64(str: string, opts?: HexAlphabet): Uint8Array {
    let s = str;
    if (opts?.alphabet === 'base64url' || /[-_]/.test(s)) {
        s = s.replace(/-/g, '+').replace(/_/g, '/');
    }
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
});

export {};
