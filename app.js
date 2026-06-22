/**
 * TECNOTV SMART PLAYER - Lógica de Aplicación y Navegación Espacial (D-Pad)
 */

// ── CONFIGURACIÓN Y ESTADO GLOBAL ──
const CONFIG = {
    DEFAULT_FOLDER: "11qu",
    ADMIN_CODE_URL: "https://tecnotv.club/admincode.php",
    BASE_URL: "https://tecnotv.club",
    // Proxy CORS público por si falla la conexión directa en navegadores de PC
    CORS_PROXY: "https://api.allorigins.win/raw?url="
};

let appState = {
    currentFolder: CONFIG.DEFAULT_FOLDER,
    activeSection: "lista.m3u", // Archivo de la sección actual
    channels: [],               // Canales de la sección actual
    filteredChannels: [],       // Canales filtrados por búsqueda
    currentPlayingUrl: "",
    hlsPlayer: null
};

// Elementos DOM
const dom = {
    menuSections: document.getElementById("menu-sections"),
    channelsGrid: document.getElementById("channels-grid"),
    channelSearch: document.getElementById("channel-search"),
    videoPlayer: document.getElementById("tv-video-player"),
    activeTitle: document.getElementById("active-category-title"),
    channelCount: document.getElementById("channel-count"),
    playingTitle: document.getElementById("playing-channel-title"),
    playingGroup: document.getElementById("playing-channel-group"),
    playerLoader: document.getElementById("player-loader"),
    clock: document.getElementById("system-clock"),
    btnFullscreen: document.getElementById("btn-fullscreen"),
    btnReload: document.getElementById("btn-reload-stream"),
    appContainer: document.querySelector(".tv-app-container")
};

// ── INICIALIZACIÓN ──
document.addEventListener("DOMContentLoaded", async () => {
    initClock();
    await resolveAdminFolder();
    setupEventListeners();
    
    // Enfocar el primer elemento del menú al iniciar
    const firstMenuBtn = document.getElementById("sec-principal");
    if (firstMenuBtn) {
        setFocus(firstMenuBtn);
        firstMenuBtn.classList.add("active");
    }
    
    // Cargar la primera lista
    loadSectionChannels("lista.m3u", "PRINCIPAL SSIPTV");
});

// ── RELOJ DEL SISTEMA ──
function initClock() {
    const updateClock = () => {
        const now = new Date();
        let hours = now.getHours().toString().padStart(2, '0');
        let minutes = now.getMinutes().toString().padStart(2, '0');
        dom.clock.textContent = `${hours}:${minutes}`;
    };
    updateClock();
    setInterval(updateClock, 60000);
}

// ── RESOLUCIÓN DINÁMICA DE LA CARPETA (ADMINCODE) ──
async function resolveAdminFolder() {
    console.log("Resolviendo carpeta IPTV...");
    const url = `${CONFIG.ADMIN_CODE_URL}?v=${Date.now()}`;
    let text = "";
    
    try {
        // Intentar directo primero
        const response = await fetchWithTimeout(url, {}, 5000);
        text = await response.text();
    } catch (error) {
        console.warn("Fallo al resolver admincode directamente (CORS/Red), intentando con proxies...");
        try {
            let proxyUrl = "";
            if (window.location.hostname.includes('vercel.app')) {
                proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            } else {
                proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            }
            const response = await fetchWithTimeout(proxyUrl, {}, 7000);
            text = await response.text();
        } catch (proxyErr) {
            try {
                const altProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const response = await fetchWithTimeout(altProxyUrl, {}, 8000);
                text = await response.text();
            } catch (err) {
                console.error("Todos los métodos fallaron para resolver admincode, usando default:", err);
            }
        }
    }
    
    if (text) {
        // Buscar la variable window.CARPETA_IPTV_ADMIN = "xxx"; usando expresiones regulares
        const match = text.match(/window\.CARPETA_IPTV_ADMIN\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
            appState.currentFolder = match[1];
            console.log(`Carpeta IPTV resuelta con éxito: ${appState.currentFolder}`);
            return;
        }
    }
    console.warn("Usando carpeta IPTV default: 11qu");
}

// ── CONFIGURACIÓN DE EVENTOS ──
function setupEventListeners() {
    // Manejar clics en el menú lateral
    const menuButtons = dom.menuSections.querySelectorAll(".menu-item");
    menuButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            menuButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const filename = btn.getAttribute("data-section");
            const title = btn.textContent.trim().replace(/^[\s\S]+?\s/, ""); // Elimina el emoji
            
            loadSectionChannels(filename, title);
        });
    });

    // Filtro de búsqueda
    dom.channelSearch.addEventListener("input", (e) => {
        filterChannels(e.target.value);
    });

    // Botones del reproductor
    dom.btnFullscreen.addEventListener("click", () => {
        toggleFullscreen();
    });

    dom.btnReload.addEventListener("click", () => {
        if (appState.currentPlayingUrl) {
            playStream(appState.currentPlayingUrl, dom.playingTitle.textContent);
        }
    });

    // Control de errores de video
    dom.videoPlayer.addEventListener("loadstart", () => {
        dom.playerLoader.style.display = "flex";
    });
    
    dom.videoPlayer.addEventListener("playing", () => {
        dom.playerLoader.style.display = "none";
    });

    dom.videoPlayer.addEventListener("error", (e) => {
        console.error("Error en reproducción:", e);
        dom.playerLoader.style.display = "none";
        dom.playingGroup.textContent = "Error: El canal no se puede reproducir o requiere un códec específico.";
        dom.playingGroup.style.color = "#ff4d4d";
    });

    // Capturar teclado para navegación D-Pad
    document.addEventListener("keydown", handleKeyDown);
}

// ── PARSEADOR M3U Y CARGA DE CANALES ──
async function loadSectionChannels(filename, title) {
    appState.activeSection = filename;
    dom.activeTitle.textContent = title;
    
    // Limpiar grid y mostrar cargando
    dom.channelsGrid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando lista de canales...</p>
        </div>
    `;
    dom.channelCount.textContent = "0 canales";
    dom.channelSearch.value = "";

    const playlistUrl = `${CONFIG.BASE_URL}/${appState.currentFolder}/${filename}`;
    console.log(`Cargando lista desde: ${playlistUrl}`);

    try {
        let m3uText = "";
        try {
            // Intentar carga directa primero
            const response = await fetchWithTimeout(playlistUrl, {}, 6000);
            m3uText = await response.text();
        } catch (corsErr) {
            console.warn("Fallo de CORS o red directa, intentando a través de proxy CORS fallback...");
            
            // Intentamos usar el proxy de Vercel si estamos desplegados, o el proxy público principal
            let proxyUrl = "";
            if (window.location.hostname.includes('vercel.app')) {
                proxyUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;
            } else {
                proxyUrl = `https://corsproxy.io/?${encodeURIComponent(playlistUrl)}`;
            }
            
            try {
                const response = await fetchWithTimeout(proxyUrl, {}, 8000);
                m3uText = await response.text();
            } catch (proxyErr) {
                console.warn("Fallo con primer proxy, intentando con proxy secundario (AllOrigins)...");
                const altProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(playlistUrl)}`;
                const response = await fetchWithTimeout(altProxyUrl, {}, 10000);
                m3uText = await response.text();
            }
        }

        // Parsear el texto M3U
        appState.channels = parseM3U(m3uText);
        appState.filteredChannels = [...appState.channels];
        
        console.log(`Parseados exitosamente ${appState.channels.length} canales`);
        
        renderChannels();
    } catch (error) {
        console.error("Error cargando o parseando la lista M3U:", error);
        dom.channelsGrid.innerHTML = `
            <div class="error-state">
                <p>⚠️ Error de Conexión</p>
                <p style="font-size: 14px; margin-top: 8px;">No se pudo cargar la lista de canales de TecnoTV.</p>
                <button class="control-btn focusable" onclick="loadSectionChannels('${filename}', '${title}')" style="margin-top:15px; max-width: 200px;">
                    Reintentar
                </button>
            </div>
        `;
        // Registrar el reintentar en el gestor espacial
        rebuildSpatialIndexes();
    }
}

// Parser M3U simple pero robusto
function parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith("#EXTINF:")) {
            currentChannel = {};
            
            // Extraer nombre de canal (después de la última coma)
            const commaIndex = line.lastIndexOf(",");
            if (commaIndex !== -1) {
                currentChannel.name = line.substring(commaIndex + 1).trim();
            } else {
                currentChannel.name = "Canal sin nombre";
            }

            // Extraer logo (tvg-logo)
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            if (logoMatch && logoMatch[1]) {
                currentChannel.logo = logoMatch[1];
            }

            // Extraer grupo/categoría (group-title)
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            if (groupMatch && groupMatch[1]) {
                currentChannel.group = groupMatch[1];
            } else {
                currentChannel.group = "Canales";
            }
        } else if (line && !line.startsWith("#") && currentChannel) {
            // Es la URL de streaming
            currentChannel.url = line;
            channels.push(currentChannel);
            currentChannel = null; // Reiniciar para el siguiente canal
        }
    }
    return channels;
}

// Renderizar canales en la cuadrícula
function renderChannels() {
    dom.channelsGrid.innerHTML = "";
    dom.channelCount.textContent = `${appState.filteredChannels.length} canales`;

    if (appState.filteredChannels.length === 0) {
        dom.channelsGrid.innerHTML = `
            <div class="loading-state">
                <p>🔍 No se encontraron canales en esta sección.</p>
            </div>
        `;
        rebuildSpatialIndexes();
        return;
    }

    appState.filteredChannels.forEach((channel, index) => {
        const card = document.createElement("div");
        card.className = "channel-card focusable";
        card.setAttribute("tabindex", "0");
        card.setAttribute("id", `ch-${index}`);
        
        // Detectar si está activo
        if (appState.currentPlayingUrl === channel.url) {
            card.classList.add("active-play");
        }

        let logoHtml = "";
        if (channel.logo) {
            logoHtml = `<img src="${channel.logo}" class="channel-logo" alt="${channel.name}" onerror="imgError(this)">`;
        } else {
            logoHtml = `<span class="channel-logo-fallback">📺</span>`;
        }

        card.innerHTML = `
            <div class="channel-logo-container">
                ${logoHtml}
            </div>
            <div class="channel-name">${channel.name}</div>
        `;

        card.addEventListener("click", () => {
            // Remover marca de activo anterior
            const activeCards = dom.channelsGrid.querySelectorAll(".channel-card.active-play");
            activeCards.forEach(c => c.classList.remove("active-play"));
            
            // Marcar actual
            card.classList.add("active-play");
            
            // Reproducir stream
            playStream(channel.url, channel.name, channel.group);
        });

        dom.channelsGrid.appendChild(card);
    });

    // Re-indexar los elementos enfocables del D-pad
    rebuildSpatialIndexes();
}

// Fallback de carga de imagen de canal
window.imgError = function(image) {
    image.onerror = null;
    const parent = image.parentNode;
    parent.innerHTML = `<span class="channel-logo-fallback">📺</span>`;
    return true;
};

// Filtrar canales según búsqueda
function filterChannels(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
        appState.filteredChannels = [...appState.channels];
    } else {
        appState.filteredChannels = appState.channels.filter(ch => 
            ch.name.toLowerCase().includes(cleanQuery) || 
            (ch.group && ch.group.toLowerCase().includes(cleanQuery))
        );
    }
    renderChannels();
}

// Clase cargadora personalizada de HLS para redirigir peticiones a través del proxy CORS
class ProxyLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
    }
    load(context, config, callbacks) {
        const originalUrl = context.url;
        
        // No aplicar proxy a peticiones locales o si ya es una petición de proxy
        if (!originalUrl.startsWith('http') || originalUrl.includes('corsproxy.io') || originalUrl.includes('/api/proxy')) {
            super.load(context, config, callbacks);
            return;
        }

        // Para evitar sobrecargar el proxy de Vercel con fragmentos binarios pesados de video,
        // usamos corsproxy.io que está optimizado para retransmisión de alta velocidad
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
        context.url = proxyUrl;
        
        super.load(context, config, callbacks);
    }
}

// ── REPRODUCTOR DE VIDEO (HLS / NATIVO) ──
function playStream(url, title, group = "IPTV Stream") {
    console.log(`Iniciando reproducción de canal: ${title} -> ${url}`);
    
    appState.currentPlayingUrl = url;
    dom.playingTitle.textContent = title;
    dom.playingGroup.textContent = group;
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "flex";

    // Destruir reproductor HLS previo si existe
    if (appState.hlsPlayer) {
        appState.hlsPlayer.destroy();
        appState.hlsPlayer = null;
    }

    // Comprobar si es un archivo HLS (.m3u8)
    const isHls = url.includes(".m3u8") || url.includes("playlist");

    if (isHls && Hls.isSupported()) {
        // Usar HLS.js con el cargador de proxy personalizado
        appState.hlsPlayer = new Hls({
            maxBufferSize: 10 * 1024 * 1024,
            maxBufferLength: 10,
            liveSyncDurationCount: 3,
            pLoader: ProxyLoader,
            fLoader: ProxyLoader
        });
        
        appState.hlsPlayer.loadSource(url);
        appState.hlsPlayer.attachMedia(dom.videoPlayer);
        
        appState.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            dom.videoPlayer.play().catch(err => {
                console.warn("Autoplay bloqueado:", err);
            });
        });

        appState.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error("Error de red HLS fatal, intentando recuperar...");
                        appState.hlsPlayer.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error("Error de medio HLS fatal, intentando recuperar...");
                        appState.hlsPlayer.recoverMediaError();
                        break;
                    default:
                        console.error("Error HLS no recuperable:", data);
                        dom.videoPlayer.dispatchEvent(new Event("error"));
                        break;
                }
            }
        });
    } else {
        // Intentar reproducción nativa del navegador (Android/TV/Safari soportan HLS nativo directamente)
        dom.videoPlayer.src = url;
        dom.videoPlayer.load();
        dom.videoPlayer.play().catch(err => {
            console.warn("Autoplay nativo bloqueado:", err);
        });
    }
}

// ── CONTROL DE PANTALLA COMPLETA ──
function toggleFullscreen() {
    const isFullscreen = dom.appContainer.classList.toggle("fullscreen-mode");
    if (isFullscreen) {
        dom.btnFullscreen.textContent = "🔲 Salir de Pantalla Completa";
        // Intentar Fullscreen nativo de API del navegador en TV si está disponible
        try {
            if (dom.appContainer.requestFullscreen) {
                dom.appContainer.requestFullscreen();
            }
        } catch (e) {
            console.warn("Nativo fullscreen no soportado o bloqueado por política:", e);
        }
    } else {
        dom.btnFullscreen.textContent = "📺 Pantalla Completa";
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        } catch (e) {}
        
        // Devolver foco al botón de pantalla completa
        setTimeout(() => {
            setFocus(dom.btnFullscreen);
        }, 100);
    }
    rebuildSpatialIndexes();
}

// ── GESTOR DE NAVEGACIÓN ESPACIAL (D-PAD) POR PROXIMIDAD GEOMÉTRICA ──
let activeFocusedElement = null;
let focusableElements = [];

function setFocus(element) {
    if (!element) return;
    
    // Remover clase anterior
    if (activeFocusedElement) {
        activeFocusedElement.classList.remove("focused");
    }
    
    activeFocusedElement = element;
    activeFocusedElement.classList.add("focused");
    
    // Llamar al foco real para que el lector de pantalla / browser responda
    activeFocusedElement.focus();
    
    // Auto-scroll para elementos ocultos o en contenedores con scroll
    ensureVisible(activeFocusedElement);
}

function ensureVisible(el) {
    // Si el elemento está en la cuadrícula de canales, hacer scroll en su contenedor
    const gridContainer = dom.channelsGrid.parentElement;
    if (gridContainer.contains(el)) {
        const containerRect = gridContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        if (elRect.top < containerRect.top) {
            gridContainer.scrollTop -= (containerRect.top - elRect.top) + 10;
        } else if (elRect.bottom > containerRect.bottom) {
            gridContainer.scrollTop += (elRect.bottom - containerRect.bottom) + 10;
        }
    }
    
    // Si está en el menú lateral
    if (dom.menuSections.contains(el)) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function rebuildSpatialIndexes() {
    // Obtener todos los elementos visibles de la clase .focusable
    focusableElements = Array.from(document.querySelectorAll(".focusable")).filter(el => {
        // Verificar si es visible en el DOM (dimensiones mayor a 0)
        return el.offsetWidth > 0 && el.offsetHeight > 0;
    });
    
    // Si el elemento enfocado ya no está en la lista de enfocables (ej. se borró de la lista), enfocar el primero
    if (activeFocusedElement && !focusableElements.includes(activeFocusedElement)) {
        const fallback = focusableElements[0];
        if (fallback) setFocus(fallback);
    }
}

// Manejador del KeyDown
function handleKeyDown(e) {
    const key = e.key;
    
    // Si estamos en pantalla completa, cualquier tecla (especialmente Enter o Backspace) sale de pantalla completa
    if (dom.appContainer.classList.contains("fullscreen-mode")) {
        if (key === "Escape" || key === "Backspace" || key === "Enter" || key === "GoBack") {
            e.preventDefault();
            toggleFullscreen();
            return;
        }
        return; // Ignorar navegación en pantalla completa
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        e.preventDefault();
        navigateSpatial(key);
    } else if (key === "Enter") {
        if (activeFocusedElement) {
            e.preventDefault();
            activeFocusedElement.click();
        }
    } else if (key === "Backspace" || key === "GoBack" || key === "Escape") {
        // Al presionar Backspace regresamos al menú lateral
        e.preventDefault();
        const activeMenuBtn = dom.menuSections.querySelector(".menu-item.active");
        if (activeMenuBtn) {
            setFocus(activeMenuBtn);
        }
    }
}

// Lógica de cálculo de proximidad espacial en 2D
function navigateSpatial(direction) {
    if (!activeFocusedElement) {
        rebuildSpatialIndexes();
        if (focusableElements.length > 0) {
            setFocus(focusableElements[0]);
        }
        return;
    }

    const currentRect = activeFocusedElement.getBoundingClientRect();
    const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let bestScore = Infinity; // Cuanto menor el score, mejor candidato

    focusableElements.forEach(candidate => {
        if (candidate === activeFocusedElement) return;

        const targetRect = candidate.getBoundingClientRect();
        const targetCenter = {
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2
        };

        // Vectores de dirección y distancia
        const dx = targetCenter.x - currentCenter.x;
        const dy = targetCenter.y - currentCenter.y;

        // Comprobación de alineación según la dirección solicitada
        let isAlign = false;
        
        switch (direction) {
            case "ArrowUp":
                isAlign = dy < -5; // El destino está arriba
                break;
            case "ArrowDown":
                isAlign = dy > 5;  // El destino está abajo
                break;
            case "ArrowLeft":
                isAlign = dx < -5; // El destino está a la izquierda
                break;
            case "ArrowRight":
                isAlign = dx > 5;  // El destino está a la derecha
                break;
        }

        if (!isAlign) return;

        // Fórmula de distancia ponderada: castigar la distancia perpendicular
        // Por ejemplo, para ArrowRight queremos priorizar candidatos en la misma línea (dy = 0)
        // Dónde: Score = Distancia Principal + 2.5 * Distancia Secundaria
        let distPrincipal = 0;
        let distSecundaria = 0;

        if (direction === "ArrowLeft" || direction === "ArrowRight") {
            distPrincipal = Math.abs(dx);
            distSecundaria = Math.abs(dy);
        } else {
            distPrincipal = Math.abs(dy);
            distSecundaria = Math.abs(dx);
        }

        // Ponderar: queremos favorecer elementos alineados en el eje principal
        const score = distPrincipal + (distSecundaria * 2.5);

        if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    });

    if (bestCandidate) {
        setFocus(bestCandidate);
    }
}

// Helper para fetch con timeout
function fetchWithTimeout(resource, options = {}, timeout = 8000) {
    const { signal } = options;
    if (signal) {
        throw new Error("fetchWithTimeout no soporta signals externas directamente");
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    return fetch(resource, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(id));
}
