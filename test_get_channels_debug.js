async function test() {
    const mainUrl = "https://ofutbol.jdoxx.com/app/television";
    console.log('Fetching mainUrl:', mainUrl);
    
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    };

    try {
        const getRes = await fetch(mainUrl, { headers });
        console.log('GET Status:', getRes.status);
        console.log('GET Set-Cookie:', getRes.headers.get('set-cookie') || getRes.headers.getSetCookie());
        const html = await getRes.text();
        console.log('HTML Length:', html.length);
        if (html.length < 1000) {
            console.log('HTML content preview:');
            console.log(html);
        } else {
            console.log('HTML starts with:', html.substring(0, 300));
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

test();
