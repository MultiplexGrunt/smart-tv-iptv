/**
 * API: /api/extract-stream
 * Extrae la URL m3u8 de las páginas global2.php de streamtpday1.xyz
 * 
 * Query params:
 *   ?page=<URL_encoded_de_la_pagina_global>
 *
 * Respuesta JSON:
 *   { ok: true, url: "https://...index.m3u8?token=...", expires: <timestamp_unix> }
 *   { ok: false, error: "mensaje" }
 */
export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { page } = req.query;

    if (!page) {
        return res.status(400).json({ ok: false, error: 'Parámetro "page" requerido.' });
    }

    let pageUrl;
    try {
        pageUrl = decodeURIComponent(page);
        // Validar que sea un dominio permitido
        const allowed = ['streamtpday1.xyz', 'sudamericaplay2.com', 'culesolazo.vercel.app'];
        const hostname = new URL(pageUrl).hostname;
        if (!allowed.some(d => hostname.endsWith(d))) {
            return res.status(403).json({ ok: false, error: 'Dominio no permitido.' });
        }
    } catch (e) {
        return res.status(400).json({ ok: false, error: 'URL inválida.' });
    }

    try {
        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://streamtpday1.xyz/',
                'Origin': 'https://streamtpday1.xyz',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });

        if (!response.ok) {
            return res.status(502).json({ 
                ok: false, 
                error: `Error HTTP ${response.status} al acceder a la página del stream.` 
            });
        }

        const html = await response.text();

        // Extraer playbackURL del JS embebido
        // Patrón: var playbackURL = "https:\/\/...index.m3u8?token=...";
        const match = html.match(/var\s+playbackURL\s*=\s*"([^"]+)"/);

        if (!match || !match[1]) {
            return res.status(404).json({ 
                ok: false, 
                error: 'No se encontró playbackURL en la página. El stream puede estar caído.' 
            });
        }

        // Limpiar los escapes (el HTML tiene "https:\/\/...")
        const streamUrl = match[1].replace(/\\\//g, '/');

        // Extraer timestamp de expiración del token para informar al cliente
        // Token formato: ?token=HASH-HORAS-EXPIRA_UNIX-INICIO_UNIX
        let expiresAt = null;
        const tokenMatch = streamUrl.match(/token=[^&]+-(\d+)-(\d+)&/);
        if (tokenMatch) {
            expiresAt = parseInt(tokenMatch[2], 10); // timestamp Unix de expiración
        }

        return res.status(200).json({
            ok: true,
            url: streamUrl,
            expires: expiresAt,
            // Tiempo restante en segundos (para que el cliente sepa cuándo renovar)
            expiresIn: expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : null
        });

    } catch (error) {
        console.error('Error en extract-stream:', error);
        return res.status(500).json({ 
            ok: false, 
            error: 'Error interno al extraer el stream.', 
            details: error.message 
        });
    }
}
