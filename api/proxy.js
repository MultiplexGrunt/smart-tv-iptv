export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'El parámetro "url" es requerido.' });
    }

    try {
        console.log(`Bypassing CORS para: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: `Error al obtener la lista de tecnotv: ${response.statusText}` 
            });
        }
        
        const data = await response.text();
        
        // Habilitar cabeceras CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        return res.status(200).send(data);
    } catch (error) {
        return res.status(500).json({ 
            error: 'Error interno del servidor proxy', 
            details: error.message 
        });
    }
}
