/**
 * TECNOTV SMART PLAYER - Lógica de Aplicación y Navegación Espacial (D-Pad)
 */

// ── CONFIGURACIÓN Y ESTADO GLOBAL ──
const CONFIG = {
    DEFAULT_FOLDER: "11qu",
    ADMIN_CODE_URL: "https://tecnotv.club/admincode.php",
    BASE_URL: "https://tecnotv.club",
    CORS_PROXY: "https://api.allorigins.win/raw?url=",
    EVENTS_JSON_URL: "https://streamtpday1.xyz/wc.json",
    EVENTS_REFRESH_MS: 60 * 1000,        // Actualizar lista de eventos cada 60s
    TOKEN_RENEW_BUFFER_S: 300            // Renovar token 5 minutos antes de expirar
};

let appState = {
    currentFolder: CONFIG.DEFAULT_FOLDER,
    activeGroupElement: null,   // El grupo .accordion-group expandido actual
    activeSection: "",          // Archivo de la sección actual (ej. lista.m3u)
    channels: {},               // Canales cacheados por sección: { "lista.m3u": [...] }
    filteredChannels: [],       // Canales filtrados por búsqueda
    currentPlayingUrl: "",
    hlsPlayer: null,
    // Estado de eventos en vivo
    liveStream: {
        activeBtn: null         // Botón activo en el DOM
    }
};

// Elementos DOM
const dom = {
    accordion: document.getElementById("tv-accordion"),
    channelSearch: document.getElementById("channel-search"),
    videoPlayer: document.getElementById("tv-video-player"),
    iframePlayer: document.getElementById("tv-iframe-player"),
    playingTitle: document.getElementById("playing-channel-title"),
    playingGroup: document.getElementById("playing-channel-group"),
    playerLoader: document.getElementById("player-loader"),
    clock: document.getElementById("system-clock"),
    appContainer: document.querySelector(".tv-app-container")
};

// ── INICIALIZACIÓN ──
document.addEventListener("DOMContentLoaded", async () => {
    initClock();
    await resolveAdminFolder();
    setupEventListeners();
    
    // Cargar eventos en vivo
    loadLiveEvents();
    setInterval(loadLiveEvents, CONFIG.EVENTS_REFRESH_MS);

    // Enfocar el buscador o la primera lista al iniciar
    const searchInput = dom.channelSearch;
    if (searchInput) {
        setFocus(searchInput);
    }
    
    // Expandir por defecto la sección de eventos en vivo
    const eventsHeader = document.getElementById("sec-eventos");
    if (eventsHeader) {
        setTimeout(() => {
            const group = document.getElementById("group-eventos");
            const content = document.getElementById("eventos-content");
            if (group && content) {
                group.classList.add("active");
                content.style.display = "block";
            }
        }, 200);
    }
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
    // Manejar acordeón — excluir "eventos" que tiene su propia lógica
    const headers = dom.accordion.querySelectorAll(".accordion-header");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            if (header.dataset.section === "eventos") {
                // Toggle simple del acordeón de eventos
                const group = header.parentElement;
                const content = group.querySelector(".accordion-content");
                const isOpen = group.classList.contains("active");
                group.classList.toggle("active", !isOpen);
                content.style.display = isOpen ? "none" : "block";
                rebuildSpatialIndexes();
            } else {
                toggleAccordion(header);
            }
        });
    });

    // Filtro de búsqueda
    dom.channelSearch.addEventListener("input", (e) => {
        filterChannels(e.target.value);
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

// ── CONTROL DE ACORDEÓN ──
async function toggleAccordion(headerBtn) {
    const group = headerBtn.parentElement;
    const content = group.querySelector(".accordion-content");
    const filename = headerBtn.getAttribute("data-section");
    const isCurrentlyActive = group.classList.contains("active");

    // Colapsar todas las demás listas abiertas
    const allGroups = dom.accordion.querySelectorAll(".accordion-group");
    allGroups.forEach(g => {
        if (g !== group) {
            g.classList.remove("active");
            g.querySelector(".accordion-content").style.display = "none";
        }
    });

    if (isCurrentlyActive) {
        // Colapsar actual
        group.classList.remove("active");
        content.style.display = "none";
        appState.activeGroupElement = null;
        appState.activeSection = "";
        rebuildSpatialIndexes();
    } else {
        // Expandir actual
        group.classList.add("active");
        content.style.display = "block";
        appState.activeGroupElement = group;
        appState.activeSection = filename;
        
        // Mover foco a esta cabecera
        setFocus(headerBtn);

        // Cargar y renderizar canales para esta sección
        await loadChannelsForGroup(filename, group);
    }
}

// Carga y parseo de canales diferida
async function loadChannelsForGroup(filename, groupElement) {
    const channelsListDiv = groupElement.querySelector(".channels-list");
    
    // Si ya los tenemos en cache, los renderizamos de inmediato
    if (appState.channels[filename]) {
        renderChannels(appState.channels[filename], channelsListDiv);
        return;
    }

    // Si no, mostramos cargando en el acordeón
    channelsListDiv.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p style="font-size: 12px; margin-top:5px;">Cargando canales...</p>
        </div>
    `;
    rebuildSpatialIndexes();

    const playlistUrl = `${CONFIG.BASE_URL}/${appState.currentFolder}/${filename}`;
    console.log(`Cargando lista en acordeón desde: ${playlistUrl}`);

    try {
        let m3uText = "";
        try {
            // Intentar carga directa primero
            const response = await fetchWithTimeout(playlistUrl, {}, 6000);
            m3uText = await response.text();
        } catch (corsErr) {
            console.warn("Fallo de CORS o red directa en acordeón, intentando con proxies...");
            
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
                console.warn("Fallo con primer proxy, intentando con proxy de reserva...");
                const altProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(playlistUrl)}`;
                const response = await fetchWithTimeout(altProxyUrl, {}, 10000);
                m3uText = await response.text();
            }
        }

        // Parsear y guardar en caché
        const parsed = parseM3U(m3uText);
        appState.channels[filename] = parsed;
        
        console.log(`Cargados ${parsed.length} canales en cache para ${filename}`);
        
        // Si el usuario no ha cerrado el acordeón mientras cargaba, renderizar
        if (groupElement.classList.contains("active")) {
            renderChannels(parsed, channelsListDiv);
        }
    } catch (error) {
        console.error("Error cargando lista de canales:", error);
        channelsListDiv.innerHTML = `
            <div class="error-state" style="padding:15px 5px;">
                <p style="font-size: 12px; color:#ff4d4d;">⚠️ Error de conexión</p>
                <button class="control-btn focusable" onclick="event.stopPropagation(); loadChannelsForGroup('${filename}', document.getElementById('${groupElement.id}'))" style="margin-top:10px; height:32px; font-size:11px;">
                    Reintentar
                </button>
            </div>
        `;
        rebuildSpatialIndexes();
    }
}

// Renderizar canales dentro de su contenedor de lista
function renderChannels(channelsList, containerElement) {
    containerElement.innerHTML = "";
    
    // Obtener canales filtrados según la búsqueda
    const searchQuery = dom.channelSearch.value.toLowerCase().trim();
    const filtered = channelsList.filter(ch => 
        !searchQuery || 
        ch.name.toLowerCase().includes(searchQuery) ||
        (ch.group && ch.group.toLowerCase().includes(searchQuery))
    );

    if (filtered.length === 0) {
        containerElement.innerHTML = `
            <p style="font-size:12px; color:var(--text-dimmed); text-align:center; padding:10px 0;">
                No hay coincidencias
            </p>
        `;
        rebuildSpatialIndexes();
        return;
    }

    filtered.forEach((channel, index) => {
        const item = document.createElement("div");
        item.className = "channel-item focusable";
        item.setAttribute("tabindex", "0");
        item.setAttribute("data-url", channel.url);
        item.setAttribute("data-name", channel.name);
        item.setAttribute("data-group", channel.group);
        
        if (appState.currentPlayingUrl === channel.url) {
            item.classList.add("active-play");
        }

        let logoHtml = "";
        if (channel.logo) {
            logoHtml = `<img src="${channel.logo}" class="channel-item-logo" alt="" onerror="imgError(this)">`;
        } else {
            logoHtml = `<span style="font-size:14px;">📺</span>`;
        }

        item.innerHTML = `
            <div class="channel-item-logo-container">
                ${logoHtml}
            </div>
            <div class="channel-item-name">${channel.name}</div>
        `;

        item.addEventListener("click", (e) => {
            e.stopPropagation(); // Evitar colapsar el acordeón
            
            // Quitar marca de activo previa en toda la app
            const allItems = dom.accordion.querySelectorAll(".channel-item.active-play");
            allItems.forEach(i => i.classList.remove("active-play"));
            
            item.classList.add("active-play");
            playStream(channel.url, channel.name, channel.group);
        });

        containerElement.appendChild(item);
    });

    // Re-indexar los elementos enfocables del D-pad
    rebuildSpatialIndexes();
}

// Fallback de carga de imagen de canal
window.imgError = function(image) {
    image.onerror = null;
    const parent = image.parentNode;
    parent.innerHTML = `<span style="font-size:14px;">📺</span>`;
    return true;
};

// Filtrar canales según búsqueda (aplica a la sección activa)
function filterChannels(query) {
    if (!appState.activeSection || !appState.activeGroupElement) return;
    
    const channelsList = appState.channels[appState.activeSection];
    if (channelsList) {
        const container = appState.activeGroupElement.querySelector(".channels-list");
        renderChannels(channelsList, container);
    }
}

// Parser M3U simple y robusto
function parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith("#EXTINF:")) {
            currentChannel = {};
            
            const commaIndex = line.lastIndexOf(",");
            if (commaIndex !== -1) {
                currentChannel.name = line.substring(commaIndex + 1).trim();
            } else {
                currentChannel.name = "Canal sin nombre";
            }

            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            if (logoMatch && logoMatch[1]) {
                currentChannel.logo = logoMatch[1];
            }

            const groupMatch = line.match(/group-title="([^"]+)"/i);
            if (groupMatch && groupMatch[1]) {
                currentChannel.group = groupMatch[1];
            } else {
                currentChannel.group = "Canales";
            }
        } else if (line && !line.startsWith("#") && currentChannel) {
            currentChannel.url = line;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }
    return channels;
}

// Clase cargadora personalizada de HLS para redirigir peticiones a través del proxy CORS
class ProxyLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
    }
    load(context, config, callbacks) {
        const originalUrl = context.url;
        
        // No aplicar proxy a peticiones locales, tecnotv.club (tokens/IP) o dai.google.com (CORS abierto/bloqueo de datacenter)
        if (!originalUrl.startsWith('http') || 
            originalUrl.includes('tecnotv.club') || 
            originalUrl.includes('dai.google.com') ||
            originalUrl.includes('corsproxy.io') || 
            originalUrl.includes('/api/proxy')) {
            super.load(context, config, callbacks);
            return;
        }

        let proxyUrl = "";
        if (window.location.hostname.includes('vercel.app')) {
            // En Vercel usamos nuestra función serverless que es segura y no da 403
            proxyUrl = `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
        } else {
            // En local, usamos allorigins para dominios específicos como mdstrm.com o dai.google.com para evitar el 403 de corsproxy
            if (originalUrl.includes('mdstrm.com') || originalUrl.includes('dai.google.com')) {
                proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
            } else {
                proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
            }
        }
        
        context.url = proxyUrl;
        super.load(context, config, callbacks);
    }
}

// ── REPRODUCTOR DE VIDEO (HLS / NATIVO) ──
function playStream(url, title, group = "IPTV Stream", forceIframe = false) {
    // Convertir http a https para tecnotv.club para prevenir bloqueos de Mixed Content del navegador
    if (url.startsWith("http://tecnotv.club")) {
        url = url.replace("http://tecnotv.club", "https://tecnotv.club");
    }

    console.log(`Iniciando reproducción: ${title} -> ${url} (forceIframe=${forceIframe})`);
    
    appState.currentPlayingUrl = url;
    dom.playingTitle.textContent = title;
    dom.playingGroup.textContent = group;
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "flex";

    // 1. Limpiar/pausar reproducciones anteriores
    if (appState.hlsPlayer) {
        appState.hlsPlayer.destroy();
        appState.hlsPlayer = null;
    }
    
    dom.videoPlayer.pause();
    dom.videoPlayer.src = "";
    dom.videoPlayer.removeAttribute("src"); // Remover atributo para detener del todo en algunos browsers
    try {
        dom.videoPlayer.load();
    } catch(e) {}
    
    if (dom.iframePlayer) {
        dom.iframePlayer.src = "about:blank";
    }

    // 2. Determinar si es una página web externa (iframe) o un stream directo
    const isWebPage = forceIframe;

    if (isWebPage) {
        // Ocultar video, mostrar iframe
        dom.videoPlayer.style.display = "none";
        dom.playerLoader.style.display = "none"; // El iframe tiene su propio indicador visual
        
        if (dom.iframePlayer) {
            dom.iframePlayer.style.display = "block";
            dom.iframePlayer.src = url;
        }
        console.log(`Cargando transmisión en iframe: ${url}`);
    } else {
        // Ocultar iframe, mostrar video
        if (dom.iframePlayer) {
            dom.iframePlayer.style.display = "none";
        }
        dom.videoPlayer.style.display = "block";

        const isHls = url.includes(".m3u8") || url.includes("playlist");

        if (isHls && Hls.isSupported()) {
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
            dom.videoPlayer.src = url;
            dom.videoPlayer.load();
            dom.videoPlayer.play().catch(err => {
                console.warn("Autoplay nativo bloqueado:", err);
            });
        }
    }
}

// ── CONTROL DE PANTALLA COMPLETA (via teclado) ──
function toggleFullscreen() {
    const isFullscreen = dom.appContainer.classList.toggle("fullscreen-mode");
    try {
        if (isFullscreen) {
            if (dom.appContainer.requestFullscreen) dom.appContainer.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    } catch (e) {
        console.warn("Fullscreen nativo no soportado:", e);
    }
    rebuildSpatialIndexes();
}

// ── GESTOR DE NAVEGACIÓN ESPACIAL (D-PAD) POR PROXIMIDAD GEOMÉTRICA ──
let activeFocusedElement = null;
let focusableElements = [];

function setFocus(element) {
    if (!element) return;
    
    if (activeFocusedElement) {
        activeFocusedElement.classList.remove("focused");
    }
    
    activeFocusedElement = element;
    activeFocusedElement.classList.add("focused");
    activeFocusedElement.focus();
    
    ensureVisible(activeFocusedElement);
}

function ensureVisible(el) {
    // Si el elemento está dentro de un acordeón expandido, asegurar scroll en su contenedor
    const contentParent = el.closest(".accordion-content");
    if (contentParent && contentParent.contains(el)) {
        const containerRect = contentParent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        if (elRect.top < containerRect.top) {
            contentParent.scrollTop -= (containerRect.top - elRect.top) + 8;
        } else if (elRect.bottom > containerRect.bottom) {
            contentParent.scrollTop += (elRect.bottom - containerRect.bottom) + 8;
        }
    }

    // Asegurar visibilidad en el menú general del acordeón
    if (dom.accordion.contains(el)) {
        const accordionRect = dom.accordion.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        if (elRect.top < accordionRect.top) {
            dom.accordion.scrollTop -= (accordionRect.top - elRect.top) + 12;
        } else if (elRect.bottom > accordionRect.bottom) {
            dom.accordion.scrollTop += (elRect.bottom - accordionRect.bottom) + 12;
        }
    }
}

function rebuildSpatialIndexes() {
    // Obtener todos los elementos enfocables activos y visibles en pantalla
    focusableElements = Array.from(document.querySelectorAll(".focusable")).filter(el => {
        return el.offsetWidth > 0 && el.offsetHeight > 0;
    });
    
    if (activeFocusedElement && !focusableElements.includes(activeFocusedElement)) {
        const fallback = focusableElements[0];
        if (fallback) setFocus(fallback);
    }
}

// Manejador del KeyDown
function handleKeyDown(e) {
    const key = e.key;
    
    if (dom.appContainer.classList.contains("fullscreen-mode")) {
        if (key === "Escape" || key === "Backspace" || key === "Enter" || key === "GoBack") {
            e.preventDefault();
            toggleFullscreen();
            return;
        }
        return;
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
        e.preventDefault();
        
        // Si el foco está en un canal, volver a enfocar la cabecera de su acordeón
        if (activeFocusedElement && activeFocusedElement.classList.contains("channel-item")) {
            const group = activeFocusedElement.closest(".accordion-group");
            if (group) {
                const header = group.querySelector(".accordion-header");
                if (header) {
                    setFocus(header);
                    return;
                }
            }
        }
        
        // De lo contrario, ir al buscador
        const searchInput = dom.channelSearch;
        if (searchInput && activeFocusedElement !== searchInput) {
            setFocus(searchInput);
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
    let bestScore = Infinity;

    focusableElements.forEach(candidate => {
        if (candidate === activeFocusedElement) return;

        const targetRect = candidate.getBoundingClientRect();
        const targetCenter = {
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2
        };

        const dx = targetCenter.x - currentCenter.x;
        const dy = targetCenter.y - currentCenter.y;

        let isAlign = false;
        
        switch (direction) {
            case "ArrowUp":
                isAlign = dy < -2;
                break;
            case "ArrowDown":
                isAlign = dy > 2;
                break;
            case "ArrowLeft":
                isAlign = dx < -2;
                break;
            case "ArrowRight":
                isAlign = dx > 2;
                break;
        }

        if (!isAlign) return;

        let distPrincipal = 0;
        let distSecundaria = 0;

        if (direction === "ArrowLeft" || direction === "ArrowRight") {
            distPrincipal = Math.abs(dx);
            distSecundaria = Math.abs(dy);
        } else {
            distPrincipal = Math.abs(dy);
            distSecundaria = Math.abs(dx);
        }

        // Ponderación: priorizamos la alineación en la dirección principal
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
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    return fetch(resource, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(id));
}

// ════════════════════════════════════════════════════════
//  MÓDULO: EVENTOS DEPORTIVOS EN VIVO (streamtpday1.xyz)
// ════════════════════════════════════════════════════════

/**
 * Carga el JSON de eventos y renderiza el acordeón de Eventos en Vivo.
 * Se llama cada 60 segundos automáticamente.
 */
async function loadLiveEvents() {
    const listEl = document.getElementById("eventos-list");
    if (!listEl) return;

    try {
        const proxyUrl = buildProxyUrl(CONFIG.EVENTS_JSON_URL);
        const res = await fetchWithTimeout(proxyUrl, {}, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const events = data.events || [];

        if (events.length === 0) {
            listEl.innerHTML = `<p style="font-size:12px;color:var(--text-dimmed);text-align:center;padding:10px">Sin eventos disponibles</p>`;
            return;
        }

        // Mostrar badge LIVE en el header
        const badge = document.getElementById("eventos-badge");
        if (badge) badge.style.display = "inline-block";

        renderLiveEvents(events, listEl);

    } catch (err) {
        console.warn("Error cargando eventos en vivo:", err);
        if (!listEl.querySelector(".event-item")) {
            listEl.innerHTML = `<div class="error-state"><p>⚠️ Error al cargar eventos</p></div>`;
        }
    }
}

/**
 * Renderiza la lista de eventos en el DOM.
 * Solo actualiza si los datos cambiaron (evita parpadeos).
 */
function renderLiveEvents(events, container) {
    const newHtml = events.map(ev => {
        const links = ev.links || [];
        const statusIcon = links.some(l => l.status === "live") ? "🔴" : "⏰";

        const linksHtml = links.map(lk => {
            const qualityClass = lk.quality.type === "fhd" ? "fhd" : lk.quality.type === "sd" ? "sd" : "";
            const label = lk.server;
            const langFlag = lk.lang.code === "es" ? "🇪🇸" : lk.lang.code === "us" ? "🇺🇸" : lk.lang.code === "br" ? "🇧🇷" : lk.lang.code === "de" ? "🇩🇪" : "🌐";

            return `
                <button class="event-stream-btn focusable"
                    data-page-url="${encodeURIComponent(lk.url)}"
                    data-stream-name="${ev.title} — ${label}"
                    data-stream-group="${ev.category}"
                    tabindex="0">
                    ${langFlag}
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
                    <span class="stream-quality ${qualityClass}">${lk.quality.label}</span>
                    <span class="stream-renew-icon">🔄</span>
                </button>`;
        }).join("");

        if (!linksHtml.trim()) return "";

        return `
            <div class="event-item">
                <div class="event-item-title">
                    ${statusIcon} ${ev.title}
                    <span class="event-item-time">${ev.time}</span>
                </div>
                <div class="event-links-list">
                    ${linksHtml}
                </div>
            </div>`;
    }).join("");

    if (!newHtml.trim()) {
        container.innerHTML = `<p style="font-size:12px;color:var(--text-dimmed);text-align:center;padding:10px">No hay streams disponibles</p>`;
        return;
    }

    // Evitar re-render si el contenido es idéntico
    const currentHash = container.dataset.eventsHash;
    const newHash = newHtml.length.toString();
    if (currentHash === newHash) return;

    container.dataset.eventsHash = newHash;
    container.innerHTML = newHtml;

    // Asignar eventos de clic a los botones de stream
    container.querySelectorAll(".event-stream-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
            const name    = btn.dataset.streamName;
            const group   = btn.dataset.streamGroup;
            resolveAndPlayLiveStream(btn, pageUrl, name, group);
        });
    });

    rebuildSpatialIndexes();
}

/**
 * Carga directamente la URL original en el reproductor.
 */
function resolveAndPlayLiveStream(btn, pageUrl, name, group) {
    // Quitar activo anterior
    if (appState.liveStream.activeBtn) {
        appState.liveStream.activeBtn.classList.remove("active-play");
        const prevIcon = appState.liveStream.activeBtn.querySelector(".stream-renew-icon");
        if (prevIcon) prevIcon.textContent = "🔄";
    }

    // Guardar estado
    appState.liveStream.activeBtn = btn;

    btn.classList.add("active-play");
    const icon = btn.querySelector(".stream-renew-icon");
    if (icon) icon.textContent = "✅";

    console.log(`▶ Cargando evento en el reproductor (iframe): ${name}`);

    // Reproducir vía iframe
    playStream(pageUrl, name, group, true);
}

/**
 * Construye la URL de proxy correcta según el entorno.
 * En Vercel y localhost usamos SIEMPRE el proxy serverless /api/proxy.
 * En otros entornos (SmartTV sin proxy propio) usamos allorigins como fallback.
 */
function buildProxyUrl(targetUrl) {
    const host = window.location.hostname;
    const isVercelOrLocal = host.includes("vercel.app") ||
                            host === "localhost" ||
                            host === "127.0.0.1" ||
                            host.includes(".local");

    if (isVercelOrLocal) {
        // Usar nuestro proxy serverless (sin CORS)
        return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    }

    // Fallback para entornos sin proxy propio (SmartTV directo, etc.)
    return `${CONFIG.CORS_PROXY}${encodeURIComponent(targetUrl)}`;
}
