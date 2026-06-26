/**
 * GRUNTV TV CANALES - Lógica de Aplicación, Extracción y Navegación Espacial (D-Pad)
 */

// ── CONFIGURACIÓN Y ESTADO GLOBAL ──
const CONFIG = {
    CORS_PROXY: "https://api.allorigins.win/raw?url=",
    TV_CHANNELS: [
        { id: "3lBF90yO7U", name: "Dsports", logo: "https://ofutbol.jdoxx.com/files/channels/x3wgsVJwGb.png", category: "Deportes" },
        { id: "EeVinvm5RF", name: "Win Sport +", logo: "https://ofutbol.jdoxx.com/files/channels/vdbVXJBtrH.png", category: "Deportes" },
        { id: "R1tmdOgPfs", name: "ESPN Argentina", logo: "https://ofutbol.jdoxx.com/files/channels/R1tmdOgPfs.png", category: "Deportes" },
        { id: "g6cgA6in4n", name: "ESPN 2 ARG", logo: "https://ofutbol.jdoxx.com/files/channels/g6cgA6in4n.png", category: "Deportes" },
        { id: "mQUcOFtkRS", name: "ESPN Colombia", logo: "https://ofutbol.jdoxx.com/files/channels/mQUcOFtkRS.png", category: "Deportes" },
        { id: "s0h9rtUZb4", name: "DAZN 1 ES", logo: "https://ofutbol.jdoxx.com/files/channels/s0h9rtUZb4.png", category: "Deportes" },
        { id: "cUMcKMHEut", name: "Tyc Sport", logo: "https://ofutbol.jdoxx.com/files/channels/cUMcKMHEut.jpg", category: "Deportes" },
        { id: "MrjtjZyYWq", name: "Fox Sports 3 ARG", logo: "https://ofutbol.jdoxx.com/files/channels/MrjtjZyYWq.webp", category: "Deportes" },
        { id: "xavP8qQxiD", name: "Caracol TV", logo: "https://ofutbol.jdoxx.com/files/channels/xavP8qQxiD.png", category: "Nacional" },
        { id: "3pDX9PZ6Bl", name: "RCN", logo: "https://ofutbol.jdoxx.com/files/channels/3pDX9PZ6Bl.png", category: "Nacional" },
        { id: "V0ilLgz5g6", name: "Win Sport", logo: "https://ofutbol.jdoxx.com/files/channels/V0ilLgz5g6.png", category: "Deportes" },
        { id: "TJXTpj8Lrc", name: "Junior de Curramba", logo: "https://ofutbol.jdoxx.com/files/channels/TJXTpj8Lrc.jpg", category: "Variedades" }
    ]
};

let appState = {
    currentPlayingUrl: "",
    hlsPlayer1: null,
    hlsPlayer2: null,
    hlsPlayerPip: null,
    menuHidden: false,
    activeBtn: null,
    splitMode: false,
    pipMode: false,
    pipCorner: "pip-top-left",
    pipSize: "medium",
    audioSplit: false,
    slotsData: {
        "1": null,
        "2": null,
        "pip": null
    }
};

// Elementos DOM
const dom = {
    eventsSection: document.getElementById("tv-events-section"),
    canalesList: document.getElementById("canales-list"),
    playerSection: document.getElementById("tv-player-section"),
    playerWrapper: document.getElementById("player-wrapper"),
    playerSlotPip: document.getElementById("player-slot-pip"),
    pipControlHeader: document.getElementById("pip-control-header"),
    playingTitle: document.getElementById("playing-channel-title"),
    playingGroup: document.getElementById("playing-channel-group"),
    playerLoader: document.getElementById("player-loader"),
    clock: document.getElementById("system-clock"),
    appContainer: document.querySelector(".tv-app-container"),
    closeBtn1: document.getElementById("btn-close-slot-1"),
    closeBtn2: document.getElementById("btn-close-slot-2"),
    closeBtnPip: document.getElementById("btn-close-slot-pip"),
    btnFullscreenToggle: document.getElementById("btn-fullscreen-toggle"),
    btnAudioSplit: document.getElementById("btn-audio-split"),
    positionBtnPip: document.getElementById("btn-position-slot-pip"),
    btnDragSlotPip: document.getElementById("btn-drag-slot-pip"),
    btnResizeSlotPip: document.getElementById("btn-resize-slot-pip"),
    splitResizer: document.getElementById("split-resizer")
};

// ── INICIALIZACIÓN ──
document.addEventListener("DOMContentLoaded", () => {
    initClock();
    renderTvChannels();
    setupEventListeners();
    setupAudioAutoInit();

    // Auto-reproducir primer canal por defecto
    setTimeout(() => {
        const firstBtn = dom.canalesList.querySelector(".event-stream-btn");
        if (firstBtn) {
            setFocus(firstBtn);
            firstBtn.click();
        }
    }, 300);
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

// ── RENDER DE CANALES EN LA GRID SUPERIOR ──
function renderTvChannels() {
    const listEl = dom.canalesList;
    if (!listEl) return;

    const html = CONFIG.TV_CHANNELS.map(ch => {
        return `
            <div class="event-column">
                <div class="event-column-title" style="display: flex; align-items: center; gap: 8px;">
                    <img src="${ch.logo}" alt="${ch.name}" style="width: 18px; height: 18px; object-fit: contain; border-radius: 2px; background: rgba(255,255,255,0.05); padding: 1px;" onerror="this.style.display='none'">
                    <span class="event-title-text" style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${ch.name}">${ch.name}</span>
                </div>
                <div class="event-links-list">
                    <div class="stream-row-container">
                        <button class="event-stream-btn focusable"
                            data-channel-id="${ch.id}"
                            data-stream-name="${ch.name}"
                            data-stream-group="${ch.category}"
                            tabindex="0">
                            <span>📺 Reproducir</span>
                        </button>
                        <button class="btn-action-split focusable"
                            data-channel-id="${ch.id}"
                            data-stream-name="${ch.name}"
                            data-stream-group="${ch.category}"
                            tabindex="0"
                            title="Pantalla Partida">📺</button>
                        <button class="btn-action-pip focusable"
                            data-channel-id="${ch.id}"
                            data-stream-name="${ch.name}"
                            data-stream-group="${ch.category}"
                            tabindex="0"
                            title="PiP Flotante">🖼️</button>
                    </div>
                </div>
            </div>`;
    }).join("");

    listEl.innerHTML = html;
}

// ── CONFIGURACIÓN DE EVENTOS GENERALES ──
function setupEventListeners() {
    const mainVideo = document.getElementById("tv-video-player-1");
    if (mainVideo) {
        mainVideo.addEventListener("loadstart", () => {
            dom.playerLoader.style.display = "flex";
        });
        mainVideo.addEventListener("playing", () => {
            dom.playerLoader.style.display = "none";
        });
        mainVideo.addEventListener("error", (e) => {
            console.error("Error en reproducción:", e);
            dom.playerLoader.style.display = "none";
            dom.playingGroup.textContent = "Error: La señal no se puede reproducir o se encuentra inactiva.";
            dom.playingGroup.style.color = "#ff4d4d";
        });
    }

    // Botones de cerrar ranuras
    if (dom.closeBtn1) dom.closeBtn1.addEventListener("click", (e) => { e.stopPropagation(); handleCloseSlot1(); });
    if (dom.closeBtn2) dom.closeBtn2.addEventListener("click", (e) => { e.stopPropagation(); handleCloseSlot2(); });
    if (dom.closeBtnPip) dom.closeBtnPip.addEventListener("click", (e) => { e.stopPropagation(); handleCloseSlotPip(); });
    if (dom.positionBtnPip) dom.positionBtnPip.addEventListener("click", (e) => { e.stopPropagation(); cyclePipCorner(); });
    if (dom.btnResizeSlotPip) dom.btnResizeSlotPip.addEventListener("click", (e) => { e.stopPropagation(); cyclePipSize(); });
    if (dom.btnFullscreenToggle) dom.btnFullscreenToggle.addEventListener("click", (e) => { e.stopPropagation(); setMenuHidden(!appState.menuHidden); });
    if (dom.btnAudioSplit) dom.btnAudioSplit.addEventListener("click", (e) => { e.stopPropagation(); toggleAudioSplit(); });

    // Drag del PiP
    if (dom.pipControlHeader) {
        let isDraggingPip = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        const onDragStart = (e) => {
            if (e.target.tagName.toLowerCase() === "button" || e.target.closest("button")) return;
            e.preventDefault();
            e.stopPropagation();

            document.body.style.userSelect = "none";
            document.body.classList.add("is-dragging-pip");

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;

            const pipSlot = dom.playerSlotPip;
            if (!pipSlot) return;

            const rect = pipSlot.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            pipSlot.style.left = `${startLeft}px`;
            pipSlot.style.top = `${startTop}px`;
            pipSlot.style.bottom = "auto";
            pipSlot.style.right = "auto";
            pipSlot.className = "player-slot slot-role-pip focusable";

            isDraggingPip = true;
            const overlay = document.getElementById("iframe-drag-overlay");
            if (overlay) overlay.style.display = "block";

            document.addEventListener("mousemove", onDragMove, { passive: false });
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchend", onDragEnd);
        };

        const onDragMove = (e) => {
            if (!isDraggingPip) return;
            e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - startX;
            const dy = clientY - startY;

            const pipSlot = dom.playerSlotPip;
            if (pipSlot) {
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;
                const maxLeft = window.innerWidth - pipSlot.offsetWidth;
                const maxTop = window.innerHeight - pipSlot.offsetHeight;

                if (newLeft < 0) newLeft = 0;
                if (newLeft > maxLeft) newLeft = maxLeft;
                if (newTop < 0) newTop = 0;
                if (newTop > maxTop) newTop = maxTop;

                pipSlot.style.left = `${newLeft}px`;
                pipSlot.style.top = `${newTop}px`;
            }
        };

        const onDragEnd = () => {
            if (!isDraggingPip) return;
            isDraggingPip = false;

            document.removeEventListener("mousemove", onDragMove);
            document.removeEventListener("touchmove", onDragMove);
            document.removeEventListener("mouseup", onDragEnd);
            document.removeEventListener("touchend", onDragEnd);

            document.body.style.userSelect = "";
            document.body.classList.remove("is-dragging-pip");

            const overlay = document.getElementById("iframe-drag-overlay");
            if (overlay) overlay.style.display = "none";

            rebuildSpatialIndexes();
            const pipSlot = dom.playerSlotPip;
            if (pipSlot && activeFocusedElement === pipSlot) {
                pipSlot.classList.add("focused");
            }
        };

        dom.pipControlHeader.addEventListener("mousedown", onDragStart);
        dom.pipControlHeader.addEventListener("touchstart", onDragStart, { passive: false });
    }

    // Configurar eventos del divisor
    setupSplitResizerEvents();

    // Eventos Click en Botones de Canales
    dom.canalesList.querySelectorAll(".event-column").forEach(col => {
        // 1. Botón Reproducir Normal
        col.querySelectorAll(".event-stream-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const channelId = btn.dataset.channelId;
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;

                // Marcar botón activo
                if (appState.activeBtn) {
                    appState.activeBtn.classList.remove("active-play");
                }
                appState.activeBtn = btn;
                btn.classList.add("active-play");

                // Mostrar cargando
                dom.playerLoader.style.display = "flex";
                dom.playingTitle.textContent = `Extrayendo señal: ${name}...`;

                const streams = await fetchDecryptedStreams(channelId);
                dom.playerLoader.style.display = "none";

                if (streams && streams.length > 0) {
                    // Seleccionar la mejor señal
                    const target = selectBestStream(streams);
                    playStream(target.url, name, group, target.forceIframe);
                } else {
                    dom.playingTitle.textContent = "Error de conexión";
                    dom.playingGroup.textContent = "No se pudieron obtener señales en vivo para este canal.";
                    dom.playingGroup.style.color = "#ff4d4d";
                }
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });

        // 2. Botón Pantalla Partida (Split)
        col.querySelectorAll(".btn-action-split").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const channelId = btn.dataset.channelId;
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;

                dom.playerLoader.style.display = "flex";
                const streams = await fetchDecryptedStreams(channelId);
                dom.playerLoader.style.display = "none";

                if (streams && streams.length > 0) {
                    const target = selectBestStream(streams);
                    enableSplitScreen(target.url, name, group, target.forceIframe);
                }
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });

        // 3. Botón PiP
        col.querySelectorAll(".btn-action-pip").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const channelId = btn.dataset.channelId;
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;

                dom.playerLoader.style.display = "flex";
                const streams = await fetchDecryptedStreams(channelId);
                dom.playerLoader.style.display = "none";

                if (streams && streams.length > 0) {
                    const target = selectBestStream(streams);
                    enablePipScreen(target.url, name, group, target.forceIframe);
                }
            });

            btn.addEventListener("focus", () => {
                highlightColumn(col);
                activeFocusedElement = btn;
            });
        });
    });

    function highlightColumn(activeCol) {
        dom.canalesList.querySelectorAll(".event-column").forEach(col => {
            col.classList.remove("has-focused");
        });
        activeCol.classList.add("has-focused");
        ensureColumnVisible(activeCol);
    }

    const syncFullscreen = () => {
        const isBrowserFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        setMenuHidden(isBrowserFullscreen);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    document.addEventListener("mozfullscreenchange", syncFullscreen);
    document.addEventListener("MSFullscreenChange", syncFullscreen);

    document.addEventListener("keydown", handleKeyDown);
}

// ── LLAMADA AL BACKEND DE EXTRACCIÓN SEGURO ──
async function fetchDecryptedStreams(channelId) {
    try {
        const res = await fetch(`/api/extract-ofutbol?id=${channelId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.ok && data.stream) {
            return data.stream;
        }
        return null;
    } catch (err) {
        console.error("[Extractor Frontend Error]:", err);
        return null;
    }
}

// Seleccionar el primer stream directo (.m3u8) que use HLS (tipo 3). 
// Si no hay ninguno, caer en el iframe (tipo 1).
function selectBestStream(streams) {
    // Tipo 3: HLS .m3u8 directo
    const directStream = streams.find(s => s.tipo === 3 && s.url);
    if (directStream) {
        return { url: directStream.url, forceIframe: false };
    }
    // Tipo 1: Iframe/Página externa
    const iframeStream = streams.find(s => s.tipo === 1 && s.url);
    if (iframeStream) {
        return { url: iframeStream.url, forceIframe: true };
    }
    // Fallback absoluto al primero que exista
    const fallback = streams[0];
    return { url: fallback.url, forceIframe: fallback.tipo === 1 };
}

function ensureColumnVisible(col) {
    const container = dom.canalesList;
    const containerRect = container.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();

    if (colRect.left < containerRect.left) {
        container.scrollLeft -= (containerRect.left - colRect.left) + 20;
    } else if (colRect.right > containerRect.right) {
        container.scrollLeft += (colRect.right - containerRect.right) + 20;
    }
}

// Clase cargadora personalizada de HLS para redirigir peticiones a través del proxy CORS
class ProxyLoader extends Hls.DefaultConfig.loader {
    constructor(config) { super(config); }
    load(context, config, callbacks) {
        const originalUrl = context.url;
        if (!originalUrl.startsWith('http') || originalUrl.includes('/api/proxy') || originalUrl.includes('corsproxy.io')) {
            super.load(context, config, callbacks);
            return;
        }

        let proxyUrl = "";
        if (window.location.hostname.includes('vercel.app')) {
            proxyUrl = `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
        } else {
            proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
        }

        context.url = proxyUrl;
        super.load(context, config, callbacks);
    }
}

// ── REPRODUCTOR DE VIDEO ABSTRACTO POR RANURA (SLOT) ──
async function playStreamInSlot(slotId, url, title, group, forceIframe, isMuted = false) {
    console.log(`[Slot ${slotId}] Reproduciendo: ${title} -> ${url} (forceIframe=${forceIframe})`);

    if (!appState.slotsData) {
        appState.slotsData = { "1": null, "2": null, "pip": null };
    }
    appState.slotsData[slotId] = { url, title, group, forceIframe };

    const slotEl = document.getElementById(`player-slot-${slotId}`);
    if (!slotEl) return;

    slotEl.style.display = "block";

    let videoEl = document.getElementById(`tv-video-player-${slotId}`);
    const iframeEl = document.getElementById(`tv-iframe-player-${slotId}`);
    if (!videoEl || !iframeEl) return;

    const hlsKey = `hlsPlayer${slotId}`;
    if (appState[hlsKey]) {
        appState[hlsKey].destroy();
        appState[hlsKey] = null;
    }

    videoEl.pause();
    videoEl.src = "";
    videoEl.removeAttribute("src");
    try { videoEl.load(); } catch (e) { }

    // Recrear elemento video para evitar bugs de Web Audio
    const newVideoEl = document.createElement("video");
    newVideoEl.id = `tv-video-player-${slotId}`;
    newVideoEl.controls = true;
    newVideoEl.autoplay = true;
    newVideoEl.crossOrigin = "anonymous";
    if (videoEl.className) newVideoEl.className = videoEl.className;
    videoEl.parentNode.replaceChild(newVideoEl, videoEl);
    videoEl = newVideoEl;

    if (typeof connectVideoToWebAudio === "function") {
        connectVideoToWebAudio(slotId, videoEl);
    }

    iframeEl.src = "about:blank";
    iframeEl.removeAttribute("srcdoc");
    videoEl.muted = isMuted;

    if (forceIframe) {
        videoEl.style.display = "none";
        iframeEl.style.display = "block";
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
                videoEl.play().catch(e => console.warn(`Autoplay bloqueado en Slot ${slotId}:`, e));
            });
            appState[hlsKey].on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: appState[hlsKey].startLoad(); break;
                        case Hls.ErrorTypes.MEDIA_ERROR: appState[hlsKey].recoverMediaError(); break;
                        default: break;
                    }
                }
            });
        } else {
            videoEl.src = url;
            videoEl.load();
            videoEl.play().catch(e => console.warn("Autoplay nativo bloqueado:", e));
        }
    }
}

// Reproducción principal
function playStream(url, title, group = "Live TV", forceIframe = false) {
    appState.currentPlayingUrl = url;
    appState.slotsData["2"] = null;
    appState.slotsData["pip"] = null;
    appState.splitMode = false;
    appState.pipMode = false;

    stopSlotPlayer("2");
    stopSlotPlayer("pip");

    playStreamInSlot("1", url, title, group, forceIframe, false);
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function stopMainPlayer() {
    appState.currentPlayingUrl = "";
    appState.slotsData["1"] = null;
    appState.slotsData["2"] = null;
    appState.slotsData["pip"] = null;
    appState.splitMode = false;
    appState.pipMode = false;

    stopSlotPlayer("1");
    stopSlotPlayer("2");
    stopSlotPlayer("pip");

    dom.playingTitle.textContent = "Ningún canal seleccionado";
    dom.playingGroup.textContent = "Elige una transmisión de la parte superior para comenzar";
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "none";

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function enableSplitScreen(url, title, group, forceIframe) {
    appState.splitMode = true;
    playStreamInSlot("2", url, title, group, forceIframe, true);
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function disableSplitScreen() {
    if (!appState.splitMode) return;
    appState.splitMode = false;
    stopSlotPlayer("2");
    appState.slotsData["2"] = null;

    if (appState.audioSplit) {
        appState.audioSplit = false;
        if (audioPanners.slot1 && audioPanners.slot1.pan) audioPanners.slot1.pan.setValueAtTime(0, audioCtx ? audioCtx.currentTime : 0);
        if (audioPanners.slot2 && audioPanners.slot2.pan) audioPanners.slot2.pan.setValueAtTime(0, audioCtx ? audioCtx.currentTime : 0);
        if (dom.btnAudioSplit) dom.btnAudioSplit.classList.remove("active-play");
    }

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function enablePipScreen(url, title, group, forceIframe) {
    appState.pipMode = true;
    playStreamInSlot("pip", url, title, group, forceIframe, true);
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function cyclePipCorner() {
    const corners = ['pip-bottom-right', 'pip-bottom-left', 'pip-top-left', 'pip-top-right'];
    let currentIndex = corners.indexOf(appState.pipCorner);
    let nextIndex = (currentIndex + 1) % corners.length;

    appState.pipCorner = corners[nextIndex];
    const pipSlot = dom.playerSlotPip;
    if (pipSlot) {
        pipSlot.style.left = "";
        pipSlot.style.top = "";
        pipSlot.style.bottom = "";
        pipSlot.style.right = "";
        pipSlot.className = `player-slot slot-role-pip ${appState.pipCorner} focusable`;

        if (activeFocusedElement === pipSlot) {
            pipSlot.classList.add("focused");
        }
    }
}

function cyclePipSize() {
    const sizes = ["small", "medium", "large", "xlarge"];
    let currentIndex = sizes.indexOf(appState.pipSize);
    let nextIndex = (currentIndex + 1) % sizes.length;
    appState.pipSize = sizes[nextIndex];
    applyPipSize();
}

function applyPipSize() {
    const pipSlot = dom.playerSlotPip;
    if (!pipSlot) return;

    let width = 384, height = 216;
    if (appState.pipSize === "small") { width = 280; height = 157; }
    else if (appState.pipSize === "medium") { width = 384; height = 216; }
    else if (appState.pipSize === "large") { width = 480; height = 270; }
    else if (appState.pipSize === "xlarge") { width = 580; height = 326; }

    pipSlot.style.setProperty("--pip-width", `${width}px`);
    pipSlot.style.setProperty("--pip-height", `${height}px`);

    if (pipSlot.style.left) {
        let left = parseFloat(pipSlot.style.left) || 0;
        let top = parseFloat(pipSlot.style.top) || 0;
        const maxLeft = window.innerWidth - width;
        const maxTop = window.innerHeight - height;
        if (left < 0) left = 0;
        if (left > maxLeft) left = maxLeft;
        if (top < 0) top = 0;
        if (top > maxTop) top = maxTop;
        pipSlot.style.left = `${left}px`;
        pipSlot.style.top = `${top}px`;
    }

    rebuildSpatialIndexes();
    if (activeFocusedElement === pipSlot) {
        pipSlot.classList.add("focused");
    }
}

function disablePipScreen() {
    if (!appState.pipMode) return;
    appState.pipMode = false;
    stopSlotPlayer("pip");
    appState.slotsData["pip"] = null;
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// Cierre inteligente de ranuras
function handleCloseSlot1() {
    if (appState.slotsData["2"] && appState.slotsData["pip"]) {
        const d2 = appState.slotsData["2"], dp = appState.slotsData["pip"];
        stopSlotPlayer("1"); stopSlotPlayer("2"); stopSlotPlayer("pip");
        playStreamInSlot("1", d2.url, d2.title, d2.group, d2.forceIframe, false);
        appState.currentPlayingUrl = d2.url;
        playStreamInSlot("2", dp.url, dp.title, dp.group, dp.forceIframe, true);
        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    } else if (appState.slotsData["2"]) {
        stopSlotPlayer("1");
        appState.slotsData["1"] = null;
        appState.splitMode = false;
    } else if (appState.slotsData["pip"]) {
        const dp = appState.slotsData["pip"];
        stopSlotPlayer("1"); stopSlotPlayer("pip");
        playStreamInSlot("1", dp.url, dp.title, dp.group, dp.forceIframe, false);
        appState.currentPlayingUrl = dp.url;
        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    } else {
        stopMainPlayer();
        return;
    }
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function handleCloseSlot2() {
    if (appState.slotsData["1"] && appState.slotsData["pip"]) {
        const dp = appState.slotsData["pip"];
        stopSlotPlayer("2"); stopSlotPlayer("pip");
        playStreamInSlot("2", dp.url, dp.title, dp.group, dp.forceIframe, true);
        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    } else {
        stopSlotPlayer("2");
        appState.slotsData["2"] = null;
        appState.splitMode = false;
    }
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function handleCloseSlotPip() {
    stopSlotPlayer("pip");
    appState.slotsData["pip"] = null;
    appState.pipMode = false;
    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function stopSlotPlayer(slotId) {
    const videoEl = document.getElementById(`tv-video-player-${slotId}`);
    const iframeEl = document.getElementById(`tv-iframe-player-${slotId}`);
    if (videoEl) {
        videoEl.pause(); videoEl.src = ""; videoEl.removeAttribute("src");
        try { videoEl.load(); } catch (e) {}
    }
    if (iframeEl) {
        iframeEl.src = "about:blank"; iframeEl.removeAttribute("srcdoc");
    }
    const hlsKey = `hlsPlayer${slotId}`;
    if (appState[hlsKey]) {
        appState[hlsKey].destroy();
        appState[hlsKey] = null;
    }
}

function applySplitWidths() {
    const wrapper = dom.playerWrapper;
    if (!wrapper) return;
    const leftWidth = wrapper.dataset.splitWidthLeft || "50%";
    const leftPercent = parseFloat(leftWidth);
    const rightWidth = (100 - leftPercent) + "%";
    const leftSlot = wrapper.querySelector(".slot-role-left");
    const rightSlot = wrapper.querySelector(".slot-role-right");
    if (leftSlot) leftSlot.style.width = leftWidth;
    if (rightSlot) rightSlot.style.width = rightWidth;
}

function updateSlotsLayout() {
    const s1 = appState.slotsData["1"], s2 = appState.slotsData["2"], sp = appState.slotsData["pip"];
    const slot1El = document.getElementById("player-slot-1");
    const slot2El = document.getElementById("player-slot-2");
    const slotPipEl = document.getElementById("player-slot-pip");
    const resizerEl = dom.splitResizer;
    const wrapperEl = dom.playerWrapper;

    if (!slot1El || !slot2El || !slotPipEl) return;

    const rolesClasses = ["slot-role-single", "slot-role-left", "slot-role-right", "slot-role-pip", "slot-role-hidden"];
    [slot1El, slot2El, slotPipEl].forEach(el => {
        rolesClasses.forEach(cls => el.classList.remove(cls));
        el.style.width = "";
    });

    if (s1 && s2 && sp) {
        slot1El.classList.add("slot-role-left"); slot2El.classList.add("slot-role-right"); slotPipEl.classList.add("slot-role-pip");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        applySplitWidths();
    } else if (s1 && s2) {
        slot1El.classList.add("slot-role-left"); slot2El.classList.add("slot-role-right"); slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        applySplitWidths();
    } else if (s1 && sp) {
        slot1El.classList.add("slot-role-left"); slot2El.classList.add("slot-role-hidden"); slotPipEl.classList.add("slot-role-right");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        applySplitWidths();
    } else if (s2 && sp) {
        slot1El.classList.add("slot-role-hidden"); slot2El.classList.add("slot-role-left"); slotPipEl.classList.add("slot-role-right");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        applySplitWidths();
    } else if (s1) {
        slot1El.classList.add("slot-role-single"); slot2El.classList.add("slot-role-hidden"); slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    } else if (s2) {
        slot1El.classList.add("slot-role-hidden"); slot2El.classList.add("slot-role-single"); slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    } else if (sp) {
        slot1El.classList.add("slot-role-hidden"); slot2El.classList.add("slot-role-hidden"); slotPipEl.classList.add("slot-role-single");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    } else {
        slot1El.classList.add("slot-role-hidden"); slot2El.classList.add("slot-role-hidden"); slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    }

    if (slotPipEl.classList.contains("slot-role-pip")) {
        applyPipSize();
    } else {
        slotPipEl.style.removeProperty("--pip-width");
        slotPipEl.style.removeProperty("--pip-height");
    }

    let titles = [];
    if (s1) titles.push(s1.title);
    if (s2) titles.push(s2.title);
    if (sp && !slotPipEl.classList.contains("slot-role-pip")) titles.push(sp.title);

    if (titles.length > 0) {
        dom.playingTitle.textContent = titles.join(" | ");
        const mainSlot = s1 || s2 || sp;
        if (mainSlot) dom.playingGroup.textContent = mainSlot.group;
    } else {
        dom.playingTitle.textContent = "Ningún canal seleccionado";
        dom.playingGroup.textContent = "Elige una transmisión de la parte superior para comenzar";
    }

    if (dom.btnFullscreenToggle) dom.btnFullscreenToggle.style.display = "inline-block";
    rebuildSpatialIndexes();
}

function syncActiveButtonsInMenu() {
    const container = dom.canalesList;
    if (!container) return;

    const url1 = appState.slotsData["1"] ? appState.slotsData["1"].url : appState.currentPlayingUrl;
    const url2 = appState.slotsData["2"] ? appState.slotsData["2"].url : null;
    const urlPip = appState.slotsData["pip"] ? appState.slotsData["pip"].url : null;

    container.querySelectorAll(".event-stream-btn").forEach(btn => {
        // En nuestro caso, los botones no tienen url en dataset directos, pero podemos comparar con el id activo si los guardamos.
        // Dado que se extraen dinámicamente, podemos guardar el channelId activo en el appState.
        // Pero para simplificar, usaremos los atributos del botón.
        if (url1 && btn.classList.contains("active-play")) {
            appState.activeBtn = btn;
        }
    });
}

function requestBrowserFullscreen() {
    const el = dom.appContainer || document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(err => {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    });
}

function exitBrowserFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

function setMenuHidden(hidden) {
    if (appState.menuHidden === hidden) return;
    appState.menuHidden = hidden;

    if (hidden) {
        dom.eventsSection.classList.add("hidden");
        if (dom.btnFullscreenToggle) dom.btnFullscreenToggle.textContent = "📺";
        if (activeFocusedElement) activeFocusedElement.blur();

        const isBrowserFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isBrowserFullscreen) requestBrowserFullscreen();
    } else {
        dom.eventsSection.classList.remove("hidden");
        if (dom.btnFullscreenToggle) dom.btnFullscreenToggle.textContent = "⛶";
        setTimeout(() => {
            if (appState.activeBtn) setFocus(appState.activeBtn);
            else {
                const firstBtn = dom.canalesList.querySelector(".event-stream-btn");
                if (firstBtn) setFocus(firstBtn);
            }
        }, 150);

        const isBrowserFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (isBrowserFullscreen) exitBrowserFullscreen();
    }
}

// ── NAVEGACIÓN D-PAD ──
let activeFocusedElement = null;
let focusableElements = [];

function setFocus(element) {
    if (!element) return;
    if (activeFocusedElement) activeFocusedElement.classList.remove("focused");
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

function handleKeyDown(e) {
    const key = e.key;

    if (activeFocusedElement === dom.splitResizer) {
        if (key === "ArrowLeft" || key === "ArrowRight") {
            e.preventDefault();
            const wrapper = dom.playerWrapper;
            if (wrapper) {
                let currentWidth = parseFloat(wrapper.dataset.splitWidthLeft) || 50;
                const step = 3;
                if (key === "ArrowLeft") currentWidth -= step;
                else currentWidth += step;
                if (currentWidth < 20) currentWidth = 20;
                if (currentWidth > 80) currentWidth = 80;
                wrapper.dataset.splitWidthLeft = `${currentWidth}%`;
                applySplitWidths();
            }
            return;
        }
    }

    if (appState.menuHidden) {
        if (["ArrowUp", "ArrowDown", "Escape", "Backspace", "Enter"].includes(key)) {
            e.preventDefault();
            setMenuHidden(false);
            return;
        }
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        e.preventDefault();

        // Ocultar menú si estamos al final
        if (key === "ArrowDown" && activeFocusedElement) {
            const row = activeFocusedElement.closest(".stream-row-container");
            if (row) {
                const listContainer = row.closest(".event-links-list");
                if (listContainer) {
                    const rows = Array.from(listContainer.querySelectorAll(".stream-row-container"));
                    if (rows.indexOf(row) === rows.length - 1) {
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
            if (activeFocusedElement === dom.playerSlotPip) cyclePipCorner();
            else activeFocusedElement.click();
        }
    } else if (key === "Backspace" || key === "Escape") {
        e.preventDefault();
        if (appState.pipMode && activeFocusedElement === dom.playerSlotPip) disablePipScreen();
        else setMenuHidden(!appState.menuHidden);
    }
}

function navigateSpatial(direction) {
    if (!activeFocusedElement) {
        rebuildSpatialIndexes();
        if (focusableElements.length > 0) setFocus(focusableElements[0]);
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

        if (direction === "ArrowUp" && dy >= 0) return;
        if (direction === "ArrowDown" && dy <= 0) return;
        if (direction === "ArrowLeft" && dx >= 0) return;
        if (direction === "ArrowRight" && dx <= 0) return;

        let distPrincipal = 0, distSecundaria = 0;
        if (direction === "ArrowUp" || direction === "ArrowDown") {
            distPrincipal = Math.abs(dy);
            distSecundaria = Math.abs(dx);
        } else {
            distPrincipal = Math.abs(dx);
            distSecundaria = Math.abs(dy);
        }

        const score = distPrincipal + (distSecundaria * 2.8);
        if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    });

    if (bestCandidate) setFocus(bestCandidate);
}

// ── SISTEMA DE AUDIO DIVIDIDO ──
let audioCtx = null;
let audioSources = { slot1: null, slot2: null };
let audioPanners = { slot1: null, slot2: null };

async function initWebAudio() {
    if (audioCtx) {
        if (audioCtx.state === "suspended") await audioCtx.resume();
        return true;
    }

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") await audioCtx.resume();

        if (audioCtx.createStereoPanner) {
            audioPanners.slot1 = audioCtx.createStereoPanner();
            audioPanners.slot2 = audioCtx.createStereoPanner();
        } else {
            audioPanners.slot1 = audioCtx.createPanner();
            audioPanners.slot1.panningModel = 'HRTF';
            audioPanners.slot2 = audioCtx.createPanner();
            audioPanners.slot2.panningModel = 'HRTF';
        }

        audioPanners.slot1.connect(audioCtx.destination);
        audioPanners.slot2.connect(audioCtx.destination);

        resetPannerValue(audioPanners.slot1, 0);
        resetPannerValue(audioPanners.slot2, 0);

        const video1 = document.getElementById("tv-video-player-1");
        const video2 = document.getElementById("tv-video-player-2");
        if (video1) connectVideoToWebAudio("1", video1);
        if (video2) connectVideoToWebAudio("2", video2);

        return true;
    } catch (e) {
        console.error("Web Audio init error:", e);
        return false;
    }
}

function resetPannerValue(panner, value) {
    if (!panner) return;
    if (panner.pan) panner.pan.value = value;
    else panner.setPosition(value, 0, 0);
}

function connectVideoToWebAudio(slotId, videoEl) {
    if (!audioCtx) return;
    try {
        const key = `slot${slotId}`;
        if (audioSources[key]) {
            try { audioSources[key].disconnect(); } catch(err){}
        }
        const source = audioCtx.createMediaElementSource(videoEl);
        source.connect(audioPanners[key]);
        audioSources[key] = source;

        if (appState.audioSplit) {
            const panVal = slotId === "1" ? -1 : 1;
            resetPannerValue(audioPanners[key], panVal);
        } else {
            resetPannerValue(audioPanners[key], 0);
        }
    } catch (e) {
        console.error(`Web Audio connect error slot ${slotId}:`, e);
    }
}

function setupAudioAutoInit() {
    const initHandler = async () => {
        await initWebAudio();
        document.removeEventListener("click", initHandler);
        document.removeEventListener("keydown", initHandler);
    };
    document.addEventListener("click", initHandler);
    document.addEventListener("keydown", initHandler);
}

async function toggleAudioSplit() {
    if (!appState.splitMode) return;
    const initialized = await initWebAudio();
    if (!initialized) return;

    const video2 = document.getElementById("tv-video-player-2");
    if (!video2) return;

    appState.audioSplit = !appState.audioSplit;

    if (appState.audioSplit) {
        resetPannerValue(audioPanners.slot1, -1);
        resetPannerValue(audioPanners.slot2, 1);
        video2.muted = false;
        if (dom.btnAudioSplit) dom.btnAudioSplit.classList.add("active-play");
    } else {
        resetPannerValue(audioPanners.slot1, 0);
        resetPannerValue(audioPanners.slot2, 0);
        video2.muted = true;
        if (dom.btnAudioSplit) dom.btnAudioSplit.classList.remove("active-play");
    }
}

function setupSplitResizerEvents() {
    const resizer = dom.splitResizer;
    const wrapper = dom.playerWrapper;
    const overlay = document.getElementById("iframe-drag-overlay");

    if (!resizer || !wrapper) return;

    const startDrag = (e) => {
        e.preventDefault();
        isDraggingResizer = true;
        resizer.classList.add("focused");
        if (overlay) overlay.style.display = "block";
    };

    const doDrag = (e) => {
        if (!isDraggingResizer) return;
        let clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const wrapperRect = wrapper.getBoundingClientRect();
        const xRelative = clientX - wrapperRect.left;
        let percentage = (xRelative / wrapperRect.width) * 100;

        if (percentage < 20) percentage = 20;
        if (percentage > 80) percentage = 80;

        wrapper.dataset.splitWidthLeft = `${percentage}%`;
        applySplitWidths();
    };

    const stopDrag = () => {
        if (isDraggingResizer) {
            isDraggingResizer = false;
            resizer.classList.remove("focused");
            if (overlay) overlay.style.display = "none";
            rebuildSpatialIndexes();
        }
    };

    resizer.addEventListener("mousedown", startDrag);
    resizer.addEventListener("touchstart", startDrag);
    document.addEventListener("mousemove", doDrag);
    document.addEventListener("touchmove", doDrag);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchend", stopDrag);
}
