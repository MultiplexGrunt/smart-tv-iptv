export default async function handler(req, res) {
    const { url, referer } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'El parámetro "url" es requerido.' });
    }

    try {
        console.log(`Bypassing CORS para: ${url} (Referer: ${referer || 'ninguno'})`);
        
        let origin = '';
        if (referer) {
            try {
                const parsedUrl = new URL(referer);
                origin = parsedUrl.origin;
            } catch (e) {
                // Fallback
            }
        }
        
        // Configurar cabeceras simulando un navegador Chrome legítimo
        const fetchOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': referer || 'https://spinoff.link/',
                'Origin': origin || 'https://spinoff.link',
                'Accept': '*/*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
        };

        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            console.error(`Error en fetch remoto (${response.status}): ${response.statusText}`);
            return res.status(response.status).json({ 
                error: `Error al obtener el recurso remoto: ${response.status} ${response.statusText}` 
            });
        }
        
        // Detectar si el recurso es de texto o binario (los segmentos HLS .ts son binarios)
        const contentType = response.headers.get('Content-Type') || '';
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
        
        // Si el cliente envía una petición OPTIONS (preflight)
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (contentType.includes('text') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL') || contentType.includes('json') || url.includes('.m3u')) {
            let data = await response.text();
            
            // Si es una página HTML (Iframe), inyectamos la etiqueta <base> para resolver rutas relativas
            if (contentType.includes('text/html')) {
                const baseTag = `<base href="${url}">`;
                if (data.includes('<head>')) {
                    data = data.replace('<head>', `<head>${baseTag}`);
                } else if (data.includes('<HEAD>')) {
                    data = data.replace('<HEAD>', `<HEAD>${baseTag}`);
                } else {
                    data = baseTag + data;
                }
            }
            
            // Si es un archivo de manifiesto HLS (m3u/m3u8), reescribimos las rutas para que pasen por el proxy manteniendo el referer
            const isM3U = url.includes('.m3u') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');
            if (isM3U) {
                const lines = data.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed.length === 0 || trimmed.startsWith('#')) {
                        return line;
                    }
                    
                    let absoluteUrl = trimmed;
                    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
                        try {
                            absoluteUrl = new URL(trimmed, url).href;
                        } catch (e) {
                            console.error('Error resolviendo URL relativa:', trimmed, 'con base:', url);
                        }
                    } else if (trimmed.startsWith('//')) {
                        absoluteUrl = 'https:' + trimmed;
                    }
                    
                    return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
                });
                data = rewrittenLines.join('\n');
            }

            res.setHeader('Content-Type', contentType || 'text/plain; charset=utf-8');
            return res.status(200).send(data);
        } else {
            // Para segmentos binarios de video (.ts) u otros archivos binarios
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.setHeader('Content-Type', contentType || 'application/octet-stream');
            return res.status(200).send(buffer);
        }
    } catch (error) {
        console.error('Error en proxy serverless:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor proxy', 
            details: error.message 
        });
    }
}
