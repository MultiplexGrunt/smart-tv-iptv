/**
 * TECNOTV LIVE SPORTS PLAYER - Lógica de Aplicación y Navegación Espacial (D-Pad)
 */

// ── CONFIGURACIÓN Y ESTADO GLOBAL ──
const CONFIG = {
    EVENTS_JSON_URL: "https://streamtpday1.xyz/wc.json",
    EVENTS_REFRESH_MS: 60 * 1000,        // Actualizar lista de eventos cada 60s
    CORS_PROXY: "https://api.allorigins.win/raw?url="
};

let appState = {
    currentPlayingUrl: "",
    hlsPlayer1: null,
    hlsPlayer2: null,
    hlsPlayerPip: null,
    menuHidden: false,          // Estado de visualización a pantalla completa
    activeBtn: null,            // Botón de stream seleccionado actualmente
    splitMode: false,
    pipMode: false,
    pipCorner: "pip-bottom-right"
};

// Elementos DOM
const dom = {
    eventsSection: document.getElementById("tv-events-section"),
    eventsList: document.getElementById("eventos-list"),
    playerSection: document.getElementById("tv-player-section"),
    playerWrapper: document.getElementById("player-wrapper"),
    playerSlotPip: document.getElementById("player-slot-pip"),
    playingTitle: document.getElementById("playing-channel-title"),
    playingGroup: document.getElementById("playing-channel-group"),
    playerLoader: document.getElementById("player-loader"),
    clock: document.getElementById("system-clock"),
    appContainer: document.querySelector(".tv-app-container")
};

// ── INICIALIZACIÓN ──
document.addEventListener("DOMContentLoaded", () => {
    initClock();
    
    // Cargar eventos en vivo
    loadLiveEvents();
    setInterval(loadLiveEvents, CONFIG.EVENTS_REFRESH_MS);

    setupEventListeners();
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

// ── CONFIGURACIÓN DE EVENTOS GENERALES ──
function setupEventListeners() {
    const mainVideo = document.getElementById("tv-video-player-1");
    if (mainVideo) {
        // Control de errores de video nativo / HLS.js
        mainVideo.addEventListener("loadstart", () => {
            dom.playerLoader.style.display = "flex";
        });
        
        mainVideo.addEventListener("playing", () => {
            dom.playerLoader.style.display = "none";
        });

        mainVideo.addEventListener("error", (e) => {
            console.error("Error en reproducción:", e);
            dom.playerLoader.style.display = "none";
            dom.playingGroup.textContent = "Error: El canal no se puede reproducir o requiere un códec específico.";
            dom.playingGroup.style.color = "#ff4d4d";
        });
    }

    // Capturar teclado para navegación D-Pad
    document.addEventListener("keydown", handleKeyDown);
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
//  MÓDULO: EVENTOS DEPORTIVOS EN VIVO
// ════════════════════════════════════════════════════════

/**
 * Carga el JSON de eventos.
 */
async function loadLiveEvents() {
    const listEl = dom.eventsList;
    if (!listEl) return;

    try {
        const proxyUrl = buildProxyUrl(CONFIG.EVENTS_JSON_URL);
        const res = await fetchWithTimeout(proxyUrl, {}, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const events = data.events || [];

        if (events.length === 0) {
            listEl.innerHTML = `<p style="font-size:12px;color:var(--text-dimmed);text-align:center;padding:25px;width:100%">Sin eventos disponibles en este momento</p>`;
            return;
        }

        // Mostrar badge LIVE
        const badge = document.getElementById("eventos-badge");
        if (badge) badge.style.display = "inline-block";

        renderLiveEvents(events, listEl);

    } catch (err) {
        console.warn("Error cargando eventos en vivo:", err);
        if (!listEl.querySelector(".event-column")) {
            listEl.innerHTML = `<div class="error-state"><p>⚠️ Error al conectar con el servidor de eventos</p></div>`;
        }
    }
}

/**
 * Renderiza la lista de eventos como columnas horizontales.
 */
function renderLiveEvents(events, container) {
    // Evitar parpadeos: mapear contenido primero
    const newHtml = events.map(ev => {
        const links = ev.links || [];
        if (links.length === 0) return "";

        // ORDENAR: Español (es) primero, luego los demás idiomas
        const sortedLinks = [...links].sort((a, b) => {
            const aIsEs = (a.lang && a.lang.code === "es") ? 1 : 0;
            const bIsEs = (b.lang && b.lang.code === "es") ? 1 : 0;
            return bIsEs - aIsEs; // 1 (español) va antes que 0
        });

        const statusIcon = links.some(l => l.status === "live") ? "🔴" : "⏰";

        const linksHtml = sortedLinks.map(lk => {
            const qualityClass = lk.quality.type === "fhd" ? "fhd" : lk.quality.type === "sd" ? "sd" : "";
            const label = lk.server;
            const langFlag = lk.lang.code === "es" ? "🇪🇸" : lk.lang.code === "us" ? "🇺🇸" : lk.lang.code === "br" ? "🇧🇷" : lk.lang.code === "de" ? "🇩🇪" : "🌐";

            let isBtnActive = appState.currentPlayingUrl === lk.url;
            const pageUrlEnc = encodeURIComponent(lk.url);
            const streamName = `${ev.title} — ${label}`;

            return `
                <div class="stream-row-container">
                    <button class="event-stream-btn focusable ${isBtnActive ? 'active-play' : ''}"
                        data-page-url="${pageUrlEnc}"
                        data-stream-name="${streamName}"
                        data-stream-group="${ev.category}"
                        tabindex="0">
                        <span>${langFlag} ${label}</span>
                        <span class="stream-quality ${qualityClass}">${lk.quality.label}</span>
                    </button>
                    <button class="btn-action-split focusable"
                        data-page-url="${pageUrlEnc}"
                        data-stream-name="${streamName}"
                        data-stream-group="${ev.category}"
                        tabindex="0"
                        title="Pantalla Partida (Multi-View)">📺</button>
                    <button class="btn-action-pip focusable"
                        data-page-url="${pageUrlEnc}"
                        data-stream-name="${streamName}"
                        data-stream-group="${ev.category}"
                        tabindex="0"
                        title="Reproducir en PiP Flotante">🖼️</button>
                </div>`;
        }).join("");

        return `
            <div class="event-column">
                <div class="event-column-title">
                    <span class="event-title-text">${statusIcon} ${ev.title}</span>
                    <div class="event-column-time">
                        <span>⏰ ${ev.time}</span>
                        <span style="color:var(--teal-neon);font-weight:700">${ev.category}</span>
                    </div>
                </div>
                <div class="event-links-list">
                    ${linksHtml}
                </div>
            </div>`;
    }).join("");

    if (!newHtml.trim()) {
        container.innerHTML = `<p style="font-size:12px;color:var(--text-dimmed);text-align:center;padding:25px;width:100%">No hay transmisiones disponibles</p>`;
        return;
    }

    // Comprobar hash simple para no sobreescribir y perder el foco actual
    const currentHash = container.dataset.eventsHash;
    const newHash = newHtml.length.toString();
    if (currentHash === newHash) return;

    container.dataset.eventsHash = newHash;
    container.innerHTML = newHtml;

    // Asignar eventos a los elementos interactivos
    container.querySelectorAll(".event-column").forEach(col => {
        
        // 1. Botón Principal (Reproducir normal)
        col.querySelectorAll(".event-stream-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
                const name    = btn.dataset.streamName;
                const group   = btn.dataset.streamGroup;
                
                // Marcar botón activo
                if (appState.activeBtn) {
                    appState.activeBtn.classList.remove("active-play");
                }
                appState.activeBtn = btn;
                btn.classList.add("active-play");

                playStream(pageUrl, name, group, true);
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });

        // 2. Botón Split (Pantalla Partida)
        col.querySelectorAll(".btn-action-split").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
                const name    = btn.dataset.streamName;
                const group   = btn.dataset.streamGroup;
                enableSplitScreen(pageUrl, name, group, true);
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });

        // 3. Botón PiP (Pantalla Flotante)
        col.querySelectorAll(".btn-action-pip").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
                const name    = btn.dataset.streamName;
                const group   = btn.dataset.streamGroup;
                enablePipScreen(pageUrl, name, group, true);
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });
    });

    // Helper para iluminar la columna del partido enfocado
    function highlightColumn(activeCol) {
        container.querySelectorAll(".event-column").forEach(col => {
            col.classList.remove("has-focused");
        });
        activeCol.classList.add("has-focused");
        ensureColumnVisible(activeCol);
    }

    rebuildSpatialIndexes();

    // Si no hay elemento enfocado, enfocar el primero
    if (!activeFocusedElement) {
        const firstBtn = container.querySelector(".event-stream-btn");
        if (firstBtn) {
            setFocus(firstBtn);
            
            // Auto-reproducción automática del primer canal al ingresar a la app
            if (!appState.currentPlayingUrl) {
                console.log("Auto-reproduciendo primer canal del primer evento al ingresar...");
                firstBtn.click();
            }
        }
    }
}

// Asegurar que el scroll horizontal de las columnas de eventos acompañe al foco
function ensureColumnVisible(col) {
    const container = dom.eventsList;
    const containerRect = container.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();

    if (colRect.left < containerRect.left) {
        container.scrollLeft -= (containerRect.left - colRect.left) + 20;
    } else if (colRect.right > containerRect.right) {
        container.scrollLeft += (colRect.right - containerRect.right) + 20;
    }
}

// Clase cargadora personalizada de HLS para redirigir peticiones a través del proxy CORS (por si se reproduce m3u8 directo)
class ProxyLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
    }
    load(context, config, callbacks) {
        const originalUrl = context.url;
        
        // No aplicar proxy a peticiones locales, tecnotv.club o dai.google.com
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
            proxyUrl = `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
        } else {
            if (originalUrl.includes('mdstrm.com')) {
                proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
            } else {
                proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
            }
        }
        
        context.url = proxyUrl;
        super.load(context, config, callbacks);
    }
}

// ── REPRODUCTOR DE VIDEO ABSTRACTO POR RANURA (SLOT) ──
function playStreamInSlot(slotId, url, title, group, forceIframe, isMuted = false) {
    console.log(`[Slot ${slotId}] Reproduciendo: ${title} -> ${url} (forceIframe=${forceIframe}, isMuted=${isMuted})`);
    
    // Convertir http a https para tecnotv.club para evitar Mixed Content bloqueado por el navegador
    if (url.startsWith("http://tecnotv.club")) {
        url = url.replace("http://tecnotv.club", "https://tecnotv.club");
    }

    const slotEl = document.getElementById(`player-slot-${slotId}`);
    if (!slotEl) return;

    // Mostrar el contenedor del slot
    slotEl.style.display = "block";

    const videoEl = document.getElementById(`tv-video-player-${slotId}`);
    const iframeEl = document.getElementById(`tv-iframe-player-${slotId}`);

    if (!videoEl || !iframeEl) return;

    // Limpiar reproductor HLS previo de la ranura específica
    const hlsKey = `hlsPlayer${slotId}`;
    if (appState[hlsKey]) {
        appState[hlsKey].destroy();
        appState[hlsKey] = null;
    }

    // Limpiar reproducciones anteriores
    videoEl.pause();
    videoEl.src = "";
    videoEl.removeAttribute("src");
    try {
        videoEl.load();
    } catch(e) {}
    
    iframeEl.src = "about:blank";
    
    // Configurar sonido
    videoEl.muted = isMuted;

    const isWebPage = forceIframe;

    if (isWebPage) {
        videoEl.style.display = "none";
        iframeEl.style.display = "block";
        
        // En iframe el control de mute no es 100% estándar, pero lo cargamos directo
        iframeEl.src = url;
    } else {
        iframeEl.style.display = "none";
        videoEl.style.display = "block";

        const isHls = url.includes(".m3u8") || url.includes("playlist");

        if (isHls && Hls.isSupported()) {
            appState[hlsKey] = new Hls({
                maxBufferSize: 10 * 1024 * 1024,
                maxBufferLength: 10,
                liveSyncDurationCount: 3,
                pLoader: ProxyLoader,
                fLoader: ProxyLoader
            });
            
            appState[hlsKey].loadSource(url);
            appState[hlsKey].attachMedia(videoEl);
            
            appState[hlsKey].on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl.play().catch(err => {
                    console.warn(`Autoplay bloqueado en Slot ${slotId}:`, err);
                });
            });

            appState[hlsKey].on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            appState[hlsKey].startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            appState[hlsKey].recoverMediaError();
                            break;
                        default:
                            break;
                    }
                }
            });
        } else {
            videoEl.src = url;
            videoEl.load();
            videoEl.play().catch(err => {
                console.warn(`Autoplay nativo bloqueado en Slot ${slotId}:`, err);
            });
        }
    }
}

// Reproducción principal (Slot 1)
function playStream(url, title, group = "Live Event", forceIframe = false) {
    // Si estaba activa la pantalla partida, la removemos
    if (appState.splitMode) {
        disableSplitScreen();
    }

    appState.currentPlayingUrl = url;
    dom.playingTitle.textContent = title;
    dom.playingGroup.textContent = group;
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "none"; // El loader se maneja de forma abstracta

    // Reproducir en slot 1 principal
    playStreamInSlot("1", url, title, group, forceIframe, false);
}

// Activar Pantalla Partida (Multi-View)
function enableSplitScreen(url, title, group, forceIframe) {
    console.log("Activando Pantalla Partida...");
    
    appState.splitMode = true;
    dom.playerWrapper.classList.add("split-mode");

    // Reproducir en Slot 2. Lo cargamos silenciado para asegurar el autoplay sin bloqueos.
    playStreamInSlot("2", url, title, group, forceIframe, true);
    
    // Concatenar títulos en el overlay
    dom.playingTitle.textContent = `${dom.playingTitle.textContent.split(" | ")[0]} | ${title}`;
}

// Desactivar Pantalla Partida
function disableSplitScreen() {
    if (!appState.splitMode) return;
    
    appState.splitMode = false;
    dom.playerWrapper.classList.remove("split-mode");

    const slotEl2 = document.getElementById("player-slot-2");
    if (slotEl2) {
        slotEl2.style.display = "none";
    }

    const videoEl2 = document.getElementById("tv-video-player-2");
    const iframeEl2 = document.getElementById("tv-iframe-player-2");
    
    if (videoEl2) {
        videoEl2.pause();
        videoEl2.src = "";
        videoEl2.removeAttribute("src");
    }
    if (iframeEl2) {
        iframeEl2.src = "about:blank";
    }

    if (appState.hlsPlayer2) {
        appState.hlsPlayer2.destroy();
        appState.hlsPlayer2 = null;
    }
}

// Activar PiP flotante
function enablePipScreen(url, title, group, forceIframe) {
    console.log("Activando reproductor PiP flotante...");
    
    appState.pipMode = true;
    const pipSlot = dom.playerSlotPip;
    if (pipSlot) {
        pipSlot.style.display = "block";
        pipSlot.className = `player-slot pip-slot ${appState.pipCorner} focusable`;
        rebuildSpatialIndexes();
    }

    // Reproducir en slot PiP en silencio
    playStreamInSlot("pip", url, title, group, forceIframe, true);
}

// Rotar esquina del PiP
function cyclePipCorner() {
    const corners = ['pip-bottom-right', 'pip-bottom-left', 'pip-top-left', 'pip-top-right'];
    let currentIndex = corners.indexOf(appState.pipCorner);
    let nextIndex = (currentIndex + 1) % corners.length;
    
    appState.pipCorner = corners[nextIndex];
    const pipSlot = dom.playerSlotPip;
    if (pipSlot) {
        pipSlot.className = `player-slot pip-slot ${appState.pipCorner} focusable`;
        
        // Mantener clase de foco espacial si está enfocado
        if (activeFocusedElement === pipSlot) {
            pipSlot.classList.add("focused");
        }
        console.log(`PiP rotado a: ${appState.pipCorner}`);
    }
}

// Desactivar PiP flotante
function disablePipScreen() {
    if (!appState.pipMode) return;
    
    appState.pipMode = false;
    const pipSlot = dom.playerSlotPip;
    if (pipSlot) {
        pipSlot.style.display = "none";
    }

    const videoElPip = document.getElementById("tv-video-player-pip");
    const iframeElPip = document.getElementById("tv-iframe-player-pip");
    
    if (videoElPip) {
        videoElPip.pause();
        videoElPip.src = "";
        videoElPip.removeAttribute("src");
    }
    if (iframeElPip) {
        iframeElPip.src = "about:blank";
    }

    if (appState.hlsPlayerPip) {
        appState.hlsPlayerPip.destroy();
        appState.hlsPlayerPip = null;
    }
    rebuildSpatialIndexes();
}

// ── CONTROL DE VISIBILIDAD DE MENÚ (PANTALLA COMPLETA INTERACTIVA) ──
function setMenuHidden(hidden) {
    if (appState.menuHidden === hidden) return;
    
    appState.menuHidden = hidden;
    
    if (hidden) {
        dom.eventsSection.classList.add("hidden");
        // Desenfocar elemento actual para que el foco no interfiera
        if (activeFocusedElement) {
            activeFocusedElement.blur();
        }
    } else {
        dom.eventsSection.classList.remove("hidden");
        
        // Recuperar el foco en el último botón activo o en el primero disponible
        setTimeout(() => {
            if (appState.activeBtn) {
                setFocus(appState.activeBtn);
            } else {
                const firstBtn = dom.eventsList.querySelector(".event-stream-btn");
                if (firstBtn) setFocus(firstBtn);
            }
        }, 150);
    }
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
}

function rebuildSpatialIndexes() {
    focusableElements = Array.from(document.querySelectorAll(".focusable")).filter(el => {
        return el.offsetWidth > 0 && el.offsetHeight > 0;
    });
    
    if (activeFocusedElement && !focusableElements.includes(activeFocusedElement)) {
        const fallback = focusableElements[0];
        if (fallback) setFocus(fallback);
    }
}

// Manejador del KeyDown para D-Pad y Control de Pantalla Completa
function handleKeyDown(e) {
    const key = e.key;

    // Si el menú está oculto (pantalla completa), cualquier tecla o flecha arriba lo vuelve a mostrar
    if (appState.menuHidden) {
        if (key === "ArrowUp" || key === "ArrowDown" || key === "Escape" || key === "Backspace" || key === "Enter") {
            e.preventDefault();
            setMenuHidden(false);
            return;
        }
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        e.preventDefault();
        
        // Si presionamos flecha abajo estando en la última fila de la columna, ocultamos el menú superior
        if (key === "ArrowDown" && activeFocusedElement) {
            const row = activeFocusedElement.closest(".stream-row-container");
            if (row) {
                const listContainer = row.closest(".event-links-list");
                if (listContainer) {
                    const rows = Array.from(listContainer.querySelectorAll(".stream-row-container"));
                    const currentIndex = rows.indexOf(row);
                    if (currentIndex === rows.length - 1) {
                        // Estamos en la última fila, ocultar menú
                        setMenuHidden(true);
                        return;
                    }
                }
            }
        }

        navigateSpatial(key);
    } else if (key === "Enter") {
        if (activeFocusedElement) {
            e.preventDefault();
            if (activeFocusedElement === dom.playerSlotPip) {
                cyclePipCorner();
            } else {
                activeFocusedElement.click();
            }
        }
    } else if (key === "Backspace" || key === "Escape" || key === "GoBack") {
        e.preventDefault();
        if (appState.pipMode && activeFocusedElement === dom.playerSlotPip) {
            disablePipScreen();
        } else {
            // Alternar visualización del menú superior con retroceso
            setMenuHidden(!appState.menuHidden);
        }
    }
}

// Lógica de cálculo de proximidad espacial en 2D para navegación Smart TV
function navigateSpatial(direction) {
    if (!activeFocusedElement) {
        rebuildSpatialIndexes();
        if (focusableElements.length > 0) {
            setFocus(focusableElements[0]);
        }
        return;
    }

    const rectFocus = activeFocusedElement.getBoundingClientRect();
    const fx = rectFocus.left + rectFocus.width / 2;
    const fy = rectFocus.top + rectFocus.height / 2;

    let bestCandidate = null;
    let bestScore = Infinity;

    rebuildSpatialIndexes();

    focusableElements.forEach(candidate => {
        if (candidate === activeFocusedElement) return;

        const rectCand = candidate.getBoundingClientRect();
        const cx = rectCand.left + rectCand.width / 2;
        const cy = rectCand.top + rectCand.height / 2;

        const dx = cx - fx;
        const dy = cy - fy;

        // Comprobar la dirección correcta
        if (direction === "ArrowUp" && dy >= 0) return;
        if (direction === "ArrowDown" && dy <= 0) return;
        if (direction === "ArrowLeft" && dx >= 0) return;
        if (direction === "ArrowRight" && dx <= 0) return;

        // Calcular puntuación basada en distancia
        let distPrincipal = 0;
        let distSecundaria = 0;

        if (direction === "ArrowUp" || direction === "ArrowDown") {
            distPrincipal = Math.abs(dy);
            distSecundaria = Math.abs(dx);
        } else {
            distPrincipal = Math.abs(dx);
            distSecundaria = Math.abs(dy);
        }

        // Ponderación: priorizamos alineación directa
        const score = distPrincipal + (distSecundaria * 2.8);

        if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    });

    if (bestCandidate) {
        setFocus(bestCandidate);
    }
}

/**
 * Construye la URL de proxy correcta según el entorno.
 */
function buildProxyUrl(targetUrl) {
    const host = window.location.hostname;
    const isVercelOrLocal = host.includes("vercel.app") ||
                            host === "localhost" ||
                            host === "127.0.0.1" ||
                            host.includes(".local");

    if (isVercelOrLocal) {
        return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    }
    return `${CONFIG.CORS_PROXY}${encodeURIComponent(targetUrl)}`;
}
