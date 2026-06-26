/**
 * API: /api/extract-ofutbol
 * Descifra en tiempo real las transmisiones de ofutbol.jdoxx.com
 * Y extrae las señales directas .m3u8 desde sus respectivos iframes global1/2.php
 * 
 * Query params:
 *   ?id=<ID_del_canal_en_ofutbol>
 *
 * Respuesta JSON:
 *   { ok: true, name: "...", stream: [...] }
 *   { ok: false, error: "mensaje" }
 */

// Función auxiliar para descifrar la playbackURL del HTML de global1.php / global2.php
function decryptPlaybackURL(html) {
    // Caso 1: Desfase matemático dinámico (cx/rr/etc, ivnvQ/zpoSl/etc, OyLWt/JBuGL/etc)
    if (html.includes("function") && html.includes("return") && html.includes("atob")) {
        try {
            // 1. Buscar la asignación del array ofuscado (ej: rr=[[...]...] o cx=[[...]...])
            const arrayMatch = html.match(/(\w+)\s*=\s*(\[\[\d+,\s*"[A-Za-z0-9+/=]+"\].*?\]);/);
            // 2. Buscar todas las funciones numéricas de retorno (ej: function abc(){return 123;})
            const funcRegex = /function\s+(\w+)\s*\(\)\s*\{\s*return\s*(\d+)\s*;?\s*\}/g;
            // 3. Buscar la fórmula de k (ej: var k=abc()+def();)
            const kMatch = html.match(/var\s+k\s*=\s*(\w+)\s*\(\)\s*\+\s*(\w+)\s*\(\)/);

            if (arrayMatch && kMatch) {
                const arrayJson = arrayMatch[2];
                const dataArray = JSON.parse(arrayJson);

                const functions = {};
                let funcMatch;
                while ((funcMatch = funcRegex.exec(html)) !== null) {
                    functions[funcMatch[1]] = parseInt(funcMatch[2], 10);
                }

                const func1 = kMatch[1];
                const func2 = kMatch[2];
                const val1 = functions[func1];
                const val2 = functions[func2];

                if (val1 !== undefined && val2 !== undefined) {
                    const k = val1 + val2;
                    dataArray.sort((a, b) => a[0] - b[0]);

                    let playbackURL = "";
                    dataArray.forEach(e => {
                        let v = e[1];
                        const decoded = Buffer.from(v, 'base64').toString('utf-8');
                        const numStr = decoded.replace(/\D/g, '');
                        const code = parseInt(numStr, 10) - k;
                        playbackURL += String.fromCharCode(code);
                    });

                    if (playbackURL && playbackURL.startsWith("http")) {
                        return playbackURL;
                    }
                }
            }
        } catch (e) {
            console.error('[Decrypt Case Dynamic Error]:', e.message);
        }
    }

    // Caso 2: PlaybackURL simple (escapada tradicional)
    try {
        const simpleMatch = html.match(/var\s+playbackURL\s*=\s*"([^"]+)"/);
        if (simpleMatch && simpleMatch[1]) {
            const url = simpleMatch[1].replace(/\\\//g, '/');
            if (url.startsWith("http")) return url;
        }
    } catch (e) {
        console.error('[Decrypt Case Simple Error]:', e.message);
    }

    return null;
}

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
        let realId = id;

        // Si el id parece ser un slug (ej: colombia/win-sport-) o una url completa
        if (id.includes('/') || id.includes('http') || id.length !== 10) {
            let channelUrl = id;
            if (!id.startsWith('http')) {
                // Limpiar barras iniciales si las hay
                const cleanSlug = id.replace(/^\//, '');
                channelUrl = `https://ofutbol.jdoxx.com/app/television/${cleanSlug}`;
            }

            const pageRes = await fetch(channelUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://ofutbol.jdoxx.com/app/television"
                }
            });

            if (pageRes.ok) {
                const pageHtml = await pageRes.text();
                // Extraer el id del iframe, input o span report-live
                const iframeMatch = pageHtml.match(/src="[^"]*\/server\/play\/([A-Za-z0-9_-]+)/);
                const inputMatch = pageHtml.match(/name="connection"\s+value="([A-Za-z0-9_-]+)"/);
                const spanMatch = pageHtml.match(/class="report-live"\s+sh="([A-Za-z0-9_-]+)"/) || pageHtml.match(/sh="([A-Za-z0-9_-]+)"\s+class="report-live"/);

                realId = (iframeMatch && iframeMatch[1]) || (inputMatch && inputMatch[1]) || (spanMatch && spanMatch[1]);

                if (!realId) {
                    return res.status(404).json({
                        ok: false,
                        error: `No se pudo extraer el ID de reproducción del canal desde la URL: ${channelUrl}`
                    });
                }
            } else {
                return res.status(502).json({
                    ok: false,
                    error: `Error HTTP ${pageRes.status} al acceder a la página del canal: ${channelUrl}`
                });
            }
        }

        const playerUrl = `https://ofutbol.jdoxx.com/server/play/${realId}?lang=def`;

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

        // Algoritmo de descifrado original de la página: Base64 -> ROT13 -> Base64 -> JSON string
        const step1 = Buffer.from(sh, 'base64').toString('utf-8');
        const step2 = step1.replace(/[a-zA-Z]/gi, function(c) {
            return String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13));
        });
        const step3 = Buffer.from(step2, 'base64').toString('utf-8');
        
        const data = JSON.parse(step3);
        const originalStreams = data.stream || [];
        const processedStreams = [];

        // Procesar de forma concurrente todas las señales de tipo iframe (tipo 1) 
        // que apunten a global1.php o global2.php para extraer sus .m3u8 directos.
        await Promise.all(originalStreams.map(async (st) => {
            const isGlobalIframe = st.tipo === 1 && 
                st.url && 
                (st.url.includes("global1.php") || st.url.includes("global2.php") || st.url.includes("global.php"));

            if (isGlobalIframe) {
                try {
                    // Obtener el host del iframe para usarlo como Referer/Origin
                    const urlObj = new URL(st.url);
                    const origin = urlObj.origin;

                    const stRes = await fetch(st.url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://ofutbol.jdoxx.com/',
                            'Origin': 'https://ofutbol.jdoxx.com'
                        }
                    });

                    if (stRes.ok) {
                        const stHtml = await stRes.text();
                        const directM3u8 = decryptPlaybackURL(stHtml);

                        if (directM3u8) {
                            // Encontrado: añadir señal HLS directa (tipo 3) al principio
                            processedStreams.push({
                                tipo: 3,
                                url: directM3u8,
                                note: "Señal Directa Descifrada"
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[Extractor Silent Error] Falló extracción del iframe ${st.url}:`, err.message);
                }
            }

            // Conservar de todas formas el stream original (directo o iframe fallback) en la lista
            processedStreams.push(st);
        }));

        // Filtrar streams duplicados
        let finalStreams = processedStreams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

        // Filtrar streams rotos de culesolazo.vercel.app
        finalStreams = finalStreams.filter(st => {
            if (st.url && st.url.includes("culesolazo.vercel.app")) {
                return false;
            }
            return true;
        });

        // Ordenar streams:
        // 1. Prioridad absoluta a la Señal Directa Descifrada por nosotros en tiempo real
        // 2. Prioridad por tipo (tipo 3 directos antes que tipo 1 iframe)
        finalStreams.sort((a, b) => {
            const aDesc = a.note === "Señal Directa Descifrada" ? 1 : 0;
            const bDesc = b.note === "Señal Directa Descifrada" ? 1 : 0;
            if (aDesc !== bDesc) return bDesc - aDesc;

            return b.tipo - a.tipo;
        });

        return res.status(200).json({
            ok: true,
            name: data.name,
            photo: data.photo,
            stream: finalStreams
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
