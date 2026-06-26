/**
 * API: /api/get-channels
 * Obtiene dinámicamente el listado de canales de una categoría desde la API de ofutbol.jdoxx.com
 *
 * Query params:
 *   ?category=<HASH_DE_LA_CATEGORIA> (Por defecto Deportes: 5yGwkvtV9Q)
 *   ?page=<NUMERO_PAGINA> (Por defecto: 1)
 *
 * Respuesta JSON:
 *   { ok: true, pageTotal: 18, channels: [...] }
 *   { ok: false, error: "mensaje" }
 */

import crypto from 'crypto';

export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { category = "5yGwkvtV9Q", page = "1" } = req.query;

    const mainUrl = "https://ofutbol.jdoxx.com/app/television";
    const apiUrl = "https://ofutbol.jdoxx.com/api/general/channels";

    try {
        // 1. Acceder a la página principal para obtener cookies de sesión y CSRF Token
        const getRes = await fetch(mainUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!getRes.ok) {
            return res.status(502).json({ 
                ok: false, 
                error: `Error HTTP ${getRes.status} al acceder a la página de televisión.` 
            });
        }

        // Obtener cookies
        const rawCookies = getRes.headers.getSetCookie ? getRes.headers.getSetCookie() : getRes.headers.get('set-cookie');
        let cookieHeader = "";
        if (rawCookies) {
            cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
        }

        const html = await getRes.text();

        // Extraer token CSRF del script en el HTML usando regex flexible (por Rocket Loader)
        const tokenCsrfMatch = html.match(/<script[^>]*class="token-csrf"[^>]*>([\s\S]*?)<\/script>/);
        if (!tokenCsrfMatch) {
            return res.status(502).json({ 
                ok: false, 
                error: "No se pudo encontrar la clave CSRF en el sitio original." 
            });
        }

        const scriptContent = tokenCsrfMatch[1];
        const varRegex = /var\s+(\w+)\s*=\s*'([^']*)'/g;
        let varMatch;
        let csrfKey = "";

        while ((varMatch = varRegex.exec(scriptContent)) !== null) {
            csrfKey += varMatch[2];
        }

        if (!csrfKey) {
            return res.status(502).json({ 
                ok: false, 
                error: "No se pudieron concatenar los valores de la clave CSRF." 
            });
        }

        // 2. Calcular la firma 'x' usando HmacSHA256 y codificar en Base64
        const hmac = crypto.createHmac('sha256', csrfKey).update(category).digest('hex');
        const x = Buffer.from(hmac).toString('base64');

        // 3. Consultar la API de canales en ofutbol mediante POST
        const formData = new URLSearchParams();
        formData.append("ide", category);
        formData.append("x", x);
        formData.append("page", page);
        formData.append("s", "");
        formData.append("action", "get");

        const postRes = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://ofutbol.jdoxx.com/app/television",
                "Cookie": cookieHeader
            },
            body: formData.toString()
        });

        if (!postRes.ok) {
            return res.status(502).json({ 
                ok: false, 
                error: `Error HTTP ${postRes.status} al consultar la API de canales.` 
            });
        }

        const apiData = await postRes.json();
        if (apiData.code !== 1) {
            return res.status(502).json({ 
                ok: false, 
                error: "La API externa no retornó un código de éxito válido." 
            });
        }

        // 4. Parsear los canales del HTML devuelto en page-view
        const htmlView = apiData["page-view"] || "";
        const channelRegex = /<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*data-src="([^"]+)"[^>]*>[\s\S]*?<span class="name">([^<]+)<\/span>/g;
        let match;
        const channels = [];

        while ((match = channelRegex.exec(htmlView)) !== null) {
            const url = match[1];
            const logo = match[2];
            const name = match[3].trim();

            // Extraer slug del canal (ej: 'deportes/eleven-3')
            const slugMatch = url.match(/\/app\/television\/(.+)$/);
            const slug = slugMatch ? slugMatch[1] : url;

            channels.push({ name, slug, logo });
        }

        return res.status(200).json({
            ok: true,
            pageTotal: apiData["page-total"] || 1,
            channels: channels
        });

    } catch (error) {
        console.error("Error en get-channels:", error);
        return res.status(500).json({
            ok: false,
            error: "Error interno al obtener los canales por categoría.",
            details: error.message
        });
    }
}
