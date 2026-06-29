async function test() {
    const targetUrl = "https://ofutbol.jdoxx.com/app/television";
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
    console.log('Fetching target through allorigins proxy:', proxyUrl);
    
    try {
        const res = await fetch(proxyUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        console.log('Status:', res.status);
        const html = await res.text();
        console.log('HTML Length:', html.length);
        if (html.length > 500) {
            console.log('HTML starts with:', html.substring(0, 300));
            // Buscar si contiene Just a moment
            if (html.includes('Just a moment')) {
                console.log('Result: STILL BLOCKED BY CLOUDFLARE (Just a moment)');
            } else {
                console.log('Result: SUCCESS! Cloudflare bypassed.');
            }
        } else {
            console.log('HTML content:', html);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
