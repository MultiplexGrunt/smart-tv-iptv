/**
 * API: /api/extract-ofutbol
 * Descifra en tiempo real las transmisiones de ofutbol.jdoxx.com
 * 
 * Query params:
 *   ?id=<ID_del_canal_en_ofutbol>
 *
 * Respuesta JSON:
 *   { ok: true, name: "...", stream: [...] }
 *   { ok: false, error: "mensaje" }
 */
export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ ok: false, error: 'Parámetro "id" requerido.' });
    }

    try {
        const playerUrl = `https://ofutbol.jdoxx.com/server/play/${id}?lang=def`;

        const response = await fetch(playerUrl, {
            headers: {
                "Referer": "https://ofutbol.jdoxx.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            return res.status(502).json({ 
                ok: false, 
                error: `Error HTTP ${response.status} al acceder al reproductor externo.` 
            });
        }

        const html = await response.text();
        
        // Buscar el tag de script o elemento que contiene sh="..."
        const match = html.match(/sh="([^"]+)"/);
        if (!match || !match[1]) {
            return res.status(404).json({ 
                ok: false, 
                error: 'No se encontraron señales activas en este canal.' 
            });
        }

        const sh = match[1];

        // Algoritmo de descifrado: Base64 -> ROT13 -> Base64 -> JSON string
        const step1 = Buffer.from(sh, 'base64').toString('utf-8');
        const step2 = step1.replace(/[a-zA-Z]/gi, function(c) {
            return String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13));
        });
        const step3 = Buffer.from(step2, 'base64').toString('utf-8');
        
        const data = JSON.parse(step3);

        return res.status(200).json({
            ok: true,
            name: data.name,
            photo: data.photo,
            stream: data.stream
        });

    } catch (error) {
        console.error('Error en extract-ofutbol:', error);
        return res.status(500).json({ 
            ok: false, 
            error: 'Error interno al extraer la señal del canal.', 
            details: error.message 
        });
    }
}
