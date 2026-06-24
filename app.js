/**
 * TECNOTV LIVE SPORTS PLAYER - Lógica de Aplicación y Navegación Espacial (D-Pad)
 */

// ── CONFIGURACIÓN Y ESTADO GLOBAL ──
const CONFIG = {
    EVENTS_JSON_URL: "https://streamtpday1.xyz/wc.json",
    LACANCHA_CALENDARIO_URL: "https://lacancha.tv/es/calendario",
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
    pipCorner: "pip-top-left",
    pipSize: "medium",          // Tamaño de PiP: "small", "medium", "large"
    scores: [],                  // Almacén de marcadores deportivos en tiempo real
    audioSplit: false,           // Estado de audio dividido
    slotsData: {
        "1": null,
        "2": null,
        "pip": null
    }
};

// Elementos DOM
const dom = {
    eventsSection: document.getElementById("tv-events-section"),
    eventsList: document.getElementById("eventos-list"),
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

    // Cargar eventos en vivo
    loadLiveEvents();
    setInterval(loadLiveEvents, CONFIG.EVENTS_REFRESH_MS);

    setupEventListeners();
    setupAudioAutoInit();
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

    // Manejo de botones de cerrar ranuras con reorganización inteligente
    if (dom.closeBtn1) {
        dom.closeBtn1.addEventListener("click", (e) => {
            e.stopPropagation();
            handleCloseSlot1();
        });
    }
    if (dom.closeBtn2) {
        dom.closeBtn2.addEventListener("click", (e) => {
            e.stopPropagation();
            handleCloseSlot2();
        });
    }
    if (dom.closeBtnPip) {
        dom.closeBtnPip.addEventListener("click", (e) => {
            e.stopPropagation();
            handleCloseSlotPip();
        });
    }
    if (dom.positionBtnPip) {
        dom.positionBtnPip.addEventListener("click", (e) => {
            e.stopPropagation();
            cyclePipCorner();
        });
    }
    if (dom.pipControlHeader) {
        let isDraggingPip = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        const onDragStart = (e) => {
            // Si el clic/toque fue en un botón interactivo dentro del header, NO iniciar arrastre del PiP
            if (e.target.tagName.toLowerCase() === "button" || e.target.closest("button")) {
                return;
            }

            // Evitar comportamiento por defecto del navegador (selección de texto, etc.)
            e.preventDefault();
            e.stopPropagation();

            // Bloquear selección de texto a nivel body
            document.body.style.userSelect = "none";
            document.body.style.webkitUserSelect = "none";
            document.body.classList.add("is-dragging-pip");

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            startX = clientX;
            startY = clientY;

            const pipSlot = dom.playerSlotPip;
            if (!pipSlot) return;

            // Obtener coordenadas físicas reales en pantalla
            const rect = pipSlot.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // Asignar de inmediato estilo inline para evitar saltos al remover la clase de esquina
            pipSlot.style.left = `${startLeft}px`;
            pipSlot.style.top = `${startTop}px`;
            pipSlot.style.bottom = "auto";
            pipSlot.style.right = "auto";

            // Eliminar las clases de esquina fijas
            pipSlot.className = "player-slot slot-role-pip focusable";

            isDraggingPip = true;

            const overlay = document.getElementById("iframe-drag-overlay");
            if (overlay) {
                overlay.style.display = "block";
                overlay.style.cursor = "move";
            }

            document.addEventListener("mousemove", onDragMove, { passive: false });
            document.addEventListener("touchmove", onDragMove, { passive: false });
            document.addEventListener("mouseup", onDragEnd);
            document.addEventListener("touchend", onDragEnd);
        };

        const onDragMove = (e) => {
            if (!isDraggingPip) return;
            e.preventDefault();

            // Limpiar selecciones del portapapeles/pantalla residuales
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            }

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

        const onDragEnd = (e) => {
            if (!isDraggingPip) return;
            isDraggingPip = false;

            document.removeEventListener("mousemove", onDragMove);
            document.removeEventListener("touchmove", onDragMove);
            document.removeEventListener("mouseup", onDragEnd);
            document.removeEventListener("touchend", onDragEnd);

            // Restablecer selección de texto
            document.body.style.userSelect = "";
            document.body.style.webkitUserSelect = "";
            document.body.classList.remove("is-dragging-pip");

            const overlay = document.getElementById("iframe-drag-overlay");
            if (overlay) {
                overlay.style.display = "none";
                overlay.style.cursor = "";
            }

            rebuildSpatialIndexes();
            const pipSlot = dom.playerSlotPip;
            if (pipSlot && activeFocusedElement === pipSlot) {
                pipSlot.classList.add("focused");
            }
        };

        dom.pipControlHeader.addEventListener("mousedown", onDragStart);
        dom.pipControlHeader.addEventListener("touchstart", onDragStart, { passive: false });

        dom.pipControlHeader.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() !== "button" && !e.target.closest("button")) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
    if (dom.btnResizeSlotPip) {
        dom.btnResizeSlotPip.addEventListener("click", (e) => {
            e.stopPropagation();
            cyclePipSize();
        });
    }
    if (dom.btnFullscreenToggle) {
        dom.btnFullscreenToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            setMenuHidden(!appState.menuHidden);
        });
    }
    if (dom.btnAudioSplit) {
        dom.btnAudioSplit.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleAudioSplit();
        });
    }

    // Configurar eventos de arrastre del divisor de pantalla partida
    setupSplitResizerEvents();

    // Sincronizar salida de pantalla completa nativa (cuando el usuario presiona ESC)
    const syncFullscreen = () => {
        const isBrowserFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
        setMenuHidden(isBrowserFullscreen);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    document.addEventListener("mozfullscreenchange", syncFullscreen);
    document.addEventListener("MSFullscreenChange", syncFullscreen);

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
        // 1. Cargar primero los marcadores de La Cancha de forma asíncrona
        try {
            await loadLaCanchaScores();
        } catch (scoreErr) {
            console.warn("No se pudieron actualizar los marcadores deportivos:", scoreErr);
        }

        // 2. Cargar eventos en vivo principales
        const proxyUrl = buildProxyUrl(CONFIG.EVENTS_JSON_URL);
        const res = await fetchWithTimeout(proxyUrl, {}, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const events = data.events || [];

        if (events.length === 0) {
            listEl.innerHTML = `<p style="font-size:12px;color:var(--text-dimmed);text-align:center;padding:25px;width:100%">Sin eventos disponibles en este momento</p>`;
            return;
        }

        renderLiveEvents(events, listEl);

    } catch (err) {
        console.warn("Error cargando eventos en vivo:", err);
        if (!listEl.querySelector(".event-column")) {
            listEl.innerHTML = `<div class="error-state"><p>⚠️ Error al conectar con el servidor de eventos</p></div>`;
        }
    }
}

/**
 * Descarga y parsea la página de calendario de lacancha.tv para extraer marcadores en tiempo real.
 */
async function loadLaCanchaScores() {
    console.log("Actualizando marcadores de La Cancha...");
    const proxyUrl = buildProxyUrl(CONFIG.LACANCHA_CALENDARIO_URL);
    const res = await fetchWithTimeout(proxyUrl, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // Limpiar cadenas escapadas del payload RSC de Next.js para simplificar el parseo
    const cleanHtml = html.replace(/\\"/g, '"');
    const parsedMatches = [];
    let pos = 0;

    // Buscar todos los bloques que comiencen con "home_team"
    while ((pos = cleanHtml.indexOf('"home_team"', pos)) !== -1) {
        let openBracePos = -1;
        let braceCount = 0;

        // Buscar hacia atrás la llave de apertura del objeto
        for (let i = pos; i >= 0; i--) {
            if (cleanHtml[i] === '}') braceCount--;
            if (cleanHtml[i] === '{') {
                braceCount++;
                if (braceCount === 1) {
                    openBracePos = i;
                    break;
                }
            }
        }

        if (openBracePos !== -1) {
            let closeBracePos = -1;
            braceCount = 0;
            // Buscar hacia adelante la llave de cierre correspondiente
            for (let i = openBracePos; i < cleanHtml.length; i++) {
                if (cleanHtml[i] === '{') braceCount++;
                if (cleanHtml[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        closeBracePos = i;
                        break;
                    }
                }
            }

            if (closeBracePos !== -1) {
                const objStr = cleanHtml.slice(openBracePos, closeBracePos + 1);
                try {
                    const parsed = JSON.parse(objStr);
                    // Validar si el objeto representa la estructura de un partido de La Cancha
                    if (parsed.home_team && parsed.away_team && parsed.hasOwnProperty('home_score')) {
                        if (!parsedMatches.some(m => m.id === parsed.id)) {
                            parsedMatches.push(parsed);
                        }
                    }
                } catch (e) {
                    // Ignorar errores de sintaxis en partes mal recortadas
                }
            }
        }
        pos += 11;
    }

    if (parsedMatches.length > 0) {
        appState.scores = parsedMatches;
        console.log(`Marcadores actualizados: ${parsedMatches.length} partidos cargados.`);
    }
}

/**
 * Normaliza nombres de equipos (a minúsculas, quita acentos y caracteres especiales).
 */
function normalizeTeamName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/&/g, "and")            // reemplazar & por and
        .replace(/[^a-z0-9 ]/g, "")      // quitar caracteres especiales
        .trim();
}

// Diccionario de traducción de español a inglés para emparejar equipos
const TEAM_TRANSLATION_MAP = {
    "alemania": "germany",
    "arabia saudita": "saudi arabia",
    "argelia": "algeria",
    "belgica": "belgium",
    "brasil": "brazil",
    "cabo verde": "cape verde islands",
    "camerun": "cameroon",
    "canada": "canada",
    "congo dr": "congo dr",
    "rd congo": "congo dr",
    "corea del sur": "south korea",
    "costa de marfil": "ivory coast",
    "croacia": "croatia",
    "dinamarca": "denmark",
    "egipto": "egypt",
    "escocia": "scotland",
    "espana": "spain",
    "estados unidos": "usa",
    "eeuu": "usa",
    "francia": "france",
    "haiti": "haiti",
    "paises bajos": "netherlands",
    "holanda": "netherlands",
    "inglaterra": "england",
    "iran": "iran",
    "irak": "iraq",
    "iraq": "iraq",
    "japon": "japan",
    "jordania": "jordan",
    "marruecos": "morocco",
    "mexico": "mexico",
    "noruega": "norway",
    "nueva zelanda": "new zealand",
    "panama": "panama",
    "republica checa": "czechia",
    "chequia": "czechia",
    "sudafrica": "south africa",
    "suecia": "sweden",
    "suiza": "switzerland",
    "tunez": "tunisia",
    "turquia": "turkiye",
    "uzbekistan": "uzbekistan"
};

/**
 * Traduce el nombre del equipo y lo normaliza.
 */
function translateAndNormalize(name) {
    const norm = normalizeTeamName(name);
    if (TEAM_TRANSLATION_MAP[norm]) {
        return normalizeTeamName(TEAM_TRANSLATION_MAP[norm]);
    }
    return norm;
}

/**
 * Busca un partido coincidente en la lista de marcadores mediante emparejamiento fuzzy.
 */
function findMatchingMatch(eventTitle, allMatches) {
    if (!allMatches || allMatches.length === 0) return null;

    const splitters = [" vs ", " - ", " v "];
    let teamA = "";
    let teamB = "";

    for (const splitter of splitters) {
        if (eventTitle.toLowerCase().includes(splitter)) {
            const parts = eventTitle.split(new RegExp(splitter, "i"));
            teamA = parts[0].trim();
            teamB = parts[1].trim();
            break;
        }
    }

    if (!teamA || !teamB) return null;

    const normA = translateAndNormalize(teamA);
    const normB = translateAndNormalize(teamB);

    for (const m of allMatches) {
        const mNormHome = translateAndNormalize(m.home_team);
        const mNormAway = translateAndNormalize(m.away_team);

        // Coincidencia directa o cruzada (por si se invierte el orden local-visitante)
        const matchDirect = (mNormHome.includes(normA) || normA.includes(mNormHome)) &&
            (mNormAway.includes(normB) || normB.includes(mNormAway));

        const matchCross = (mNormHome.includes(normB) || normB.includes(mNormHome)) &&
            (mNormAway.includes(normA) || normA.includes(mNormAway));

        if (matchDirect || matchCross) {
            return m;
        }
    }

    return null;
}

/**
 * Determina si un partido es transmitido en vivo por TV Azteca (fase de grupos o fase final).
 */
function isTvAztecaMatch(eventTitle, match) {
    // 1. Fase Final: cualquier partido que no sea de la fase de grupos es transmitido por TV Azteca
    if (match && match.stage) {
        const stageNorm = match.stage.toLowerCase();
        if (!stageNorm.includes("group") && !stageNorm.includes("stage - 1") && !stageNorm.includes("stage - 2") && !stageNorm.includes("stage - 3")) {
            return true;
        }
    }

    // 2. Fase de Grupos: lista de partidos asignados a TV Azteca
    const splitters = [" vs ", " - ", " v "];
    let teamA = "";
    let teamB = "";
    for (const splitter of splitters) {
        if (eventTitle.toLowerCase().includes(splitter)) {
            const parts = eventTitle.split(new RegExp(splitter, "i"));
            teamA = parts[0].trim();
            teamB = parts[1].trim();
            break;
        }
    }

    if (!teamA || !teamB) return false;

    const normA = translateAndNormalize(teamA);
    const normB = translateAndNormalize(teamB);

    const groupMatches = [
        ["mexico", "sudafrica"],
        ["usa", "paraguay"],
        ["estados unidos", "paraguay"],
        ["brazil", "morocco"],
        ["brasil", "marruecos"],
        ["netherlands", "japan"],
        ["paises bajos", "japon"],
        ["argentina", "algeria"],
        ["argentina", "argelia"],
        ["england", "croatia"],
        ["inglaterra", "croacia"],
        ["mexico", "south korea"],
        ["mexico", "corea del sur"],
        ["brazil", "haiti"],
        ["brasil", "haiti"],
        ["netherlands", "repechaje uefa"],
        ["paises bajos", "repechaje uefa"],
        ["spain", "saudi arabia"],
        ["espana", "arabia saudita"],
        ["norway", "senegal"],
        ["noruega", "senegal"],
        ["colombia", "repechaje"],
        ["colombia", "congo dr"],
        ["colombia", "rd congo"],
        ["colombia", "RD del congo"],
        ["colombia", "republica del congo"],
        ["repechaje uefa", "mexico"],
        ["ecuador", "germany"],
        ["ecuador", "alemania"],
        ["uruguay", "spain"],
        ["uruguay", "espana"],
        ["panama", "england"],
        ["panama", "inglaterra"],
        ["colombia", "portugal"]
    ];

    for (const pair of groupMatches) {
        const p0 = translateAndNormalize(pair[0]);
        const p1 = translateAndNormalize(pair[1]);

        const matchDirect = (p0 === normA && p1 === normB) || (p0 === normB && p1 === normA);
        if (matchDirect) return true;
    }

    return false;
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

        // Intentar buscar marcador para este evento en el estado global
        const match = findMatchingMatch(ev.title, appState.scores);

        // Si es transmitido por TV Azteca, inyectar como segunda opción (índice 1)
        if (isTvAztecaMatch(ev.title, match)) {
            const aztecaLink = {
                url: "https://www.tvazteca.com/aztecadeportes/azteca-deportes-network-en-vivo",
                server: "Azteca 7 (TV Azteca)",
                quality: { label: "HD", type: "hd" },
                lang: { code: "es" }
            };

            if (sortedLinks.length >= 1) {
                sortedLinks.splice(1, 0, aztecaLink);
            } else {
                sortedLinks.push(aztecaLink);
            }
        }
        // Calcular hora local del usuario adaptándola de UTC o de UTC-5 (huso horario del wc.json)
        let displayTime = ev.time;
        if (match && match.kickoff_at) {
            try {
                const localDate = new Date(match.kickoff_at);
                const hrs = localDate.getHours().toString().padStart(2, '0');
                const mins = localDate.getMinutes().toString().padStart(2, '0');
                displayTime = `${hrs}:${mins}`;
            } catch (err) {
                console.warn("Error convirtiendo kickoff_at a hora local:", err);
            }
        } else if (ev.time) {
            try {
                const timeParts = ev.time.split(":");
                if (timeParts.length === 2) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = (today.getMonth() + 1).toString().padStart(2, '0');
                    const day = today.getDate().toString().padStart(2, '0');
                    // wc.json asume por defecto la zona horaria UTC-5
                    const isoStr = `${year}-${month}-${day}T${timeParts[0]}:${timeParts[1]}:00-05:00`;
                    const eventDate = new Date(isoStr);
                    const hrs = eventDate.getHours().toString().padStart(2, '0');
                    const mins = eventDate.getMinutes().toString().padStart(2, '0');
                    displayTime = `${hrs}:${mins}`;
                }
            } catch (err) {
                console.warn("Error convirtiendo ev.time (UTC-5) a hora local:", err);
            }
        }

        let headerTitleText = ev.title;
        let badgeHtml = "";

        if (match && match.home_score !== null && match.away_score !== null) {
            const splitters = [" vs ", " - ", " v "];
            let teamA = "";
            let teamB = "";
            for (const splitter of splitters) {
                if (ev.title.toLowerCase().includes(splitter)) {
                    const parts = ev.title.split(new RegExp(splitter, "i"));
                    teamA = parts[0].trim();
                    teamB = parts[1].trim();
                    break;
                }
            }

            if (teamA && teamB) {
                headerTitleText = `${teamA} ${match.home_score}–${match.away_score} ${teamB}`;
            } else {
                headerTitleText = `${match.home_team} ${match.home_score}–${match.away_score} ${match.away_team}`;
            }

            if (match.status === "live" || match.status === "in_play" || match.time_elapsed) {
                const elapsed = match.time_elapsed ? `${match.time_elapsed}'` : 'VIVO';
                badgeHtml = `<span class="live-score-badge" style="margin-left: 5px; font-size: 7px; padding: 1px 4px;">🔴 ${elapsed}</span>`;
            } else if (match.status === "finished") {
                badgeHtml = `<span class="final-score-badge" style="margin-left: 5px; font-size: 7px; padding: 1px 4px;">FINAL</span>`;
            }
        }

        // Si no hay marcador de La Cancha pero todos los links de stream están en estado finished
        const allLinksFinished = sortedLinks.length > 0 && sortedLinks.every(lk => lk.status === "finished");
        if (allLinksFinished && !badgeHtml) {
            badgeHtml = `<span class="final-score-badge" style="margin-left: 5px; font-size: 7px; padding: 1px 4px;">FINAL</span>`;
        }

        const linksHtml = sortedLinks.map(lk => {
            const qualityClass = lk.quality.type === "fhd" ? "fhd" : lk.quality.type === "sd" ? "sd" : "";
            const label = lk.server;
            const langFlag = lk.lang.code === "es" ? "🇪🇸" : lk.lang.code === "us" ? "🇺🇸" : lk.lang.code === "br" ? "🇧🇷" : lk.lang.code === "de" ? "🇩🇪" : "🌐";

            let isBtnActive = appState.currentPlayingUrl === lk.url;
            let isSplitActive = appState.slotsData && appState.slotsData["2"] && appState.slotsData["2"].url === lk.url;
            let isPipActive = appState.slotsData && appState.slotsData["pip"] && appState.slotsData["pip"].url === lk.url;
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
                    <button class="btn-action-split focusable ${isSplitActive ? 'active-play' : ''}"
                        data-page-url="${pageUrlEnc}"
                        data-stream-name="${streamName}"
                        data-stream-group="${ev.category}"
                        tabindex="0"
                        title="Pantalla Partida (Multi-View)">📺</button>
                    <button class="btn-action-pip focusable ${isPipActive ? 'active-play' : ''}"
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
                    <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                        <span class="event-title-text" style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${headerTitleText}">${headerTitleText}</span>
                        ${badgeHtml}
                    </div>
                    <span style="font-size: 10px; color: var(--text-muted); font-weight: 500; margin-left: 8px; flex-shrink: 0;">⏰ ${displayTime}</span>
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

    // Guardar referencia del elemento enfocado antes del re-renderizado
    let savedFocusData = null;
    if (activeFocusedElement && container.contains(activeFocusedElement)) {
        savedFocusData = {
            pageUrl: activeFocusedElement.dataset.pageUrl,
            isSplit: activeFocusedElement.classList.contains("btn-action-split"),
            isPip: activeFocusedElement.classList.contains("btn-action-pip"),
            isStream: activeFocusedElement.classList.contains("event-stream-btn")
        };
    }

    container.dataset.eventsHash = newHash;
    container.innerHTML = newHtml;

    // Asignar eventos a los elementos interactivos
    container.querySelectorAll(".event-column").forEach(col => {

        // 1. Botón Principal (Reproducir normal)
        col.querySelectorAll(".event-stream-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;

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
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;
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
                const name = btn.dataset.streamName;
                const group = btn.dataset.streamGroup;
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

    // Restaurar foco guardado
    if (savedFocusData) {
        let querySelector = "";
        if (savedFocusData.isSplit) {
            querySelector = `.btn-action-split[data-page-url="${savedFocusData.pageUrl}"]`;
        } else if (savedFocusData.isPip) {
            querySelector = `.btn-action-pip[data-page-url="${savedFocusData.pageUrl}"]`;
        } else if (savedFocusData.isStream) {
            querySelector = `.event-stream-btn[data-page-url="${savedFocusData.pageUrl}"]`;
        }

        if (querySelector) {
            const newFocusEl = container.querySelector(querySelector);
            if (newFocusEl) {
                setFocus(newFocusEl);
            }
        }
    }

    // Si no hay elemento enfocado, enfocar el primero
    if (!activeFocusedElement) {
        const firstBtn = container.querySelector(".event-stream-btn");
        if (firstBtn) {
            setFocus(firstBtn);

            // Auto-reproducción inteligente al ingresar a la app (misma hora -> split / pip)
            if (!appState.currentPlayingUrl) {
                autoPlayIntelligent(events, container);
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
async function playStreamInSlot(slotId, url, title, group, forceIframe, isMuted = false) {
    console.log(`[Slot ${slotId}] Reproduciendo: ${title} -> ${url} (forceIframe=${forceIframe}, isMuted=${isMuted})`);

    // Almacenar datos en el estado global para la reorganización inteligente
    if (!appState.slotsData) {
        appState.slotsData = { "1": null, "2": null, "pip": null };
    }
    appState.slotsData[slotId] = { url, title, group, forceIframe };

    // Interceptar señal de TV Azteca para cargarla en un iframe personalizado y limpio
    const isAztecaUrl = url.includes("tvazteca.com/aztecadeportes/azteca-deportes-network-en-vivo");
    let targetUrl = url;
    let actualForceIframe = forceIframe;
    let modifiedAztecaHtml = "";

    if (isAztecaUrl) {
        console.log(`[Slot ${slotId}] Interceptada señal de TV Azteca. Cargando HTML modificado para ocultar elementos molestos...`);
        actualForceIframe = true; // Forzar el uso de iframe
        dom.playerLoader.style.display = "flex";

        try {
            const proxyUrl = buildProxyUrl(url);
            const res = await fetchWithTimeout(proxyUrl, {}, 6000);
            if (res.ok) {
                const html = await res.text();

                const baseTag = '<base href="https://www.tvazteca.com/">';
                const customStyles = `
<style id="azteca-player-cleaner">
    /* Reset de fondo negro para todo */
    html, body, div, header, footer, main, section, article, nav, aside {
        background: #000 !important;
    }
    
    /* Ocultar elementos que estorben y anuncios */
    .header, .footer, .nav, .sidebar, .ads, .advertisement, .ad-label, .GoogleDfpAd, .underlay, [id*="banner"], [id*="adv"], [class*="adv"], [class*="banner"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
    }
    
    /* Ocultar hermanos de la jerarquia principal del reproductor */
    body > *:not(main) { display: none !important; }
    main > *:not(article) { display: none !important; }
    article > *:not(header) { display: none !important; }
    header > *:not(.videoPage__player) { display: none !important; }
    
    /* Forzar pantalla completa para el reproductor */
    html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
    }
    
    main.mainLayout, 
    article, 
    header, 
    .videoPage__player, 
    .MediaStreamVideoPlayer, 
    .MediaStreamVideoPlayer__viewport, 
    .MediaStreamVideoPlayer-player,
    iframe {
        display: block !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 9999999 !important;
        border: none !important;
    }
</style>
`;

                let modified = html;
                if (modified.includes("<head>")) {
                    modified = modified.replace("<head>", `<head>\n${baseTag}\n${customStyles}`);
                } else if (modified.includes("<HEAD>")) {
                    modified = modified.replace("<HEAD>", `<HEAD>\n${baseTag}\n${customStyles}`);
                } else {
                    modified = baseTag + customStyles + modified;
                }

                modifiedAztecaHtml = modified;
                console.log(`[Slot ${slotId}] HTML de TV Azteca inyectado con estilos de limpieza.`);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            console.warn(`[Slot ${slotId}] Error al descargar HTML de TV Azteca:`, err);
            // Fallback: cargar directo la URL en el iframe
            targetUrl = url;
        } finally {
            dom.playerLoader.style.display = "none";
        }
    }

    // Convertir http a https para tecnotv.club para evitar Mixed Content bloqueado por el navegador
    if (targetUrl.startsWith("http://tecnotv.club")) {
        targetUrl = targetUrl.replace("http://tecnotv.club", "https://tecnotv.club");
    }

    const slotEl = document.getElementById(`player-slot-${slotId}`);
    if (!slotEl) return;

    // Mostrar el contenedor del slot
    slotEl.style.display = "block";

    let videoEl = document.getElementById(`tv-video-player-${slotId}`);
    const iframeEl = document.getElementById(`tv-iframe-player-${slotId}`);

    if (!videoEl || !iframeEl) return;

    // Limpiar reproductor HLS previo de la ranura específica
    const hlsKey = `hlsPlayer${slotId}`;
    if (appState[hlsKey]) {
        appState[hlsKey].destroy();
        appState[hlsKey] = null;
    }

    // Detener reproducciones anteriores del video viejo
    videoEl.pause();
    videoEl.src = "";
    videoEl.removeAttribute("src");
    try {
        videoEl.load();
    } catch (e) { }

    // Recrear dinámicamente el elemento de video para evitar el bug de MSE + Web Audio y errores "already connected"
    const newVideoEl = document.createElement("video");
    newVideoEl.id = `tv-video-player-${slotId}`;
    newVideoEl.controls = true;
    newVideoEl.autoplay = true;
    newVideoEl.crossOrigin = "anonymous";
    if (videoEl.className) newVideoEl.className = videoEl.className;
    
    // Reemplazar en el DOM
    videoEl.parentNode.replaceChild(newVideoEl, videoEl);
    videoEl = newVideoEl;

    // Conectar el nuevo elemento a la API de Web Audio si ya fue inicializada
    if (typeof connectVideoToWebAudio === "function") {
        connectVideoToWebAudio(slotId, videoEl);
    }

    iframeEl.src = "about:blank";
    iframeEl.removeAttribute("srcdoc");

    // Configurar sonido
    videoEl.muted = isMuted;

    const isWebPage = actualForceIframe;

    if (isWebPage) {
        videoEl.style.display = "none";
        iframeEl.style.display = "block";

        // En iframe el control de mute no es 100% estándar, pero lo cargamos directo
        if (isAztecaUrl && modifiedAztecaHtml) {
            iframeEl.removeAttribute("src");
            iframeEl.srcdoc = modifiedAztecaHtml;
        } else {
            iframeEl.removeAttribute("srcdoc");
            iframeEl.src = targetUrl;
        }
    } else {
        iframeEl.style.display = "none";
        videoEl.style.display = "block";

        const isHls = targetUrl.includes(".m3u8") || targetUrl.includes("playlist");

        if (isHls && Hls.isSupported()) {
            appState[hlsKey] = new Hls({
                maxBufferSize: 10 * 1024 * 1024,
                maxBufferLength: 10,
                liveSyncDurationCount: 3,
                pLoader: ProxyLoader,
                fLoader: ProxyLoader
            });

            appState[hlsKey].loadSource(targetUrl);
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
            videoEl.src = targetUrl;
            videoEl.load();
            videoEl.play().catch(err => {
                console.warn(`Autoplay nativo bloqueado en Slot ${slotId}:`, err);
            });
        }
    }
}

// Reproducción principal (Slot 1)
function playStream(url, title, group = "Live Event", forceIframe = false) {
    console.log("[Seamless] playStream:", title);
    appState.currentPlayingUrl = url;

    // Al reproducir un canal normal, limpiamos el slot 2 y PiP
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

// Detener por completo la reproducción en el Slot 1 (Principal)
function stopMainPlayer() {
    console.log("[Seamless] Deteniendo reproductor completo...");

    appState.currentPlayingUrl = "";
    appState.slotsData["1"] = null;
    appState.slotsData["2"] = null;
    appState.slotsData["pip"] = null;
    appState.splitMode = false;
    appState.pipMode = false;

    stopSlotPlayer("1");
    stopSlotPlayer("2");
    stopSlotPlayer("pip");

    dom.playingTitle.textContent = "Ningún evento seleccionado";
    dom.playingGroup.textContent = "Elige una transmisión de la parte superior para comenzar";
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "none";

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// Activar Pantalla Partida (Multi-View)
function enableSplitScreen(url, title, group, forceIframe) {
    console.log("[Seamless] Activando Split Screen para:", title);

    appState.splitMode = true;

    // Reproducir en Slot 2 físico silenciado
    playStreamInSlot("2", url, title, group, forceIframe, true);

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// Desactivar Pantalla Partida
function disableSplitScreen() {
    if (!appState.splitMode) return;

    console.log("[Seamless] Desactivando Split Screen");
    appState.splitMode = false;

    stopSlotPlayer("2");
    appState.slotsData["2"] = null;

    // Restablecer audio dividido
    if (appState.audioSplit) {
        appState.audioSplit = false;
        if (audioPanners.slot1 && audioPanners.slot1.pan) {
            audioPanners.slot1.pan.setValueAtTime(0, audioCtx ? audioCtx.currentTime : 0);
        }
        if (audioPanners.slot2 && audioPanners.slot2.pan) {
            audioPanners.slot2.pan.setValueAtTime(0, audioCtx ? audioCtx.currentTime : 0);
        }
        if (dom.btnAudioSplit) {
            dom.btnAudioSplit.classList.remove("active-play");
        }
    }

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// Activar PiP flotante
function enablePipScreen(url, title, group, forceIframe) {
    console.log("[Seamless] Activando PiP flotante para:", title);

    appState.pipMode = true;

    // Reproducir en slot PiP físico en silencio
    playStreamInSlot("pip", url, title, group, forceIframe, true);

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// Rotar esquina del PiP
function cyclePipCorner() {
    const corners = ['pip-bottom-right', 'pip-bottom-left', 'pip-top-left', 'pip-top-right'];
    let currentIndex = corners.indexOf(appState.pipCorner);
    let nextIndex = (currentIndex + 1) % corners.length;

    appState.pipCorner = corners[nextIndex];
    const pipSlot = dom.playerSlotPip;
    if (pipSlot) {
        // Limpiar coordenadas inline previas de arrastre
        pipSlot.style.left = "";
        pipSlot.style.top = "";
        pipSlot.style.bottom = "";
        pipSlot.style.right = "";
        pipSlot.className = `player-slot slot-role-pip ${appState.pipCorner} focusable`;

        // Mantener clase de foco espacial si está enfocado
        if (activeFocusedElement === pipSlot) {
            pipSlot.classList.add("focused");
        }
        console.log(`PiP rotado a: ${appState.pipCorner}`);
    }
}

// Cambiar secuencialmente el tamaño de PiP (Pequeño -> Mediano -> Grande -> Extra Grande)
function cyclePipSize() {
    const sizes = ["small", "medium", "large", "xlarge"];
    let currentIndex = sizes.indexOf(appState.pipSize);
    let nextIndex = (currentIndex + 1) % sizes.length;
    appState.pipSize = sizes[nextIndex];

    applyPipSize();
}

// Aplicar dimensiones al PiP basado en appState.pipSize
function applyPipSize() {
    const pipSlot = dom.playerSlotPip;
    if (!pipSlot) return;

    let width = 384;
    let height = 216;

    if (appState.pipSize === "small") {
        width = 280;
        height = 157;
    } else if (appState.pipSize === "medium") {
        width = 384;
        height = 216;
    } else if (appState.pipSize === "large") {
        width = 480;
        height = 270;
    } else if (appState.pipSize === "xlarge") {
        width = 580;
        height = 326;
    }

    pipSlot.style.setProperty("--pip-width", `${width}px`);
    pipSlot.style.setProperty("--pip-height", `${height}px`);

    console.log(`[PiP] Tamaño establecido a: ${appState.pipSize} (${width}x${height}px)`);

    // Si el PiP ya ha sido arrastrado (tiene left inline), asegurar que no se desborde al crecer
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

    // Mantener la clase de foco espacial si está enfocado
    if (activeFocusedElement === pipSlot) {
        pipSlot.classList.add("focused");
    }
}



// Desactivar PiP flotante
function disablePipScreen() {
    if (!appState.pipMode) return;

    console.log("[Seamless] Desactivando PiP flotante");
    appState.pipMode = false;

    stopSlotPlayer("pip");
    appState.slotsData["pip"] = null;

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// ── MANEJADORES DE CIERRE INTELIGENTE (REORGANIZACIÓN DINÁMICA DE SLOTS) ──
function handleCloseSlot1() {
    console.log("[Smart Close - Seamless] Cerrando Slot 1...");
    
    if (appState.slotsData["2"] && appState.slotsData["pip"]) {
        // Caso 3 pantallas: Cierra 1. Promueve físicamente 2 -> 1 y Pip -> 2. Libera Pip.
        const data2 = appState.slotsData["2"];
        const dataPip = appState.slotsData["pip"];

        stopSlotPlayer("1");
        stopSlotPlayer("2");
        stopSlotPlayer("pip");

        playStreamInSlot("1", data2.url, data2.title, data2.group, data2.forceIframe, false);
        appState.currentPlayingUrl = data2.url;

        playStreamInSlot("2", dataPip.url, dataPip.title, dataPip.group, dataPip.forceIframe, true);

        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    }
    else if (appState.slotsData["2"]) {
        // Caso 2 pantallas (Slot 1 y Slot 2). Cierra 1.
        // Aquí NO es necesario recargar físicamente. El Slot 2 físico asume el rol single.
        stopSlotPlayer("1");
        appState.slotsData["1"] = null;
        appState.splitMode = false;
    }
    else if (appState.slotsData["pip"]) {
        // Caso 2 pantallas (Slot 1 y PiP). Cierra 1. Promueve físicamente Pip -> 1. Libera Pip.
        const dataPip = appState.slotsData["pip"];

        stopSlotPlayer("1");
        stopSlotPlayer("pip");

        playStreamInSlot("1", dataPip.url, dataPip.title, dataPip.group, dataPip.forceIframe, false);
        appState.currentPlayingUrl = dataPip.url;

        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    }
    else {
        // Caso 1 pantalla activa.
        stopMainPlayer();
        return;
    }

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function handleCloseSlot2() {
    console.log("[Smart Close - Seamless] Cerrando Slot 2...");
    
    if (appState.slotsData["1"] && appState.slotsData["pip"]) {
        // Caso 3 pantallas: Cierra 2. Promueve físicamente Pip -> 2. Libera Pip.
        const dataPip = appState.slotsData["pip"];

        stopSlotPlayer("2");
        stopSlotPlayer("pip");

        playStreamInSlot("2", dataPip.url, dataPip.title, dataPip.group, dataPip.forceIframe, true);

        appState.slotsData["pip"] = null;
        appState.pipMode = false;
    }
    else {
        // Caso 2 pantallas (Slot 1 y Slot 2). Cierra 2.
        stopSlotPlayer("2");
        appState.slotsData["2"] = null;
        appState.splitMode = false;
    }

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

function handleCloseSlotPip() {
    console.log("[Smart Close - Seamless] Cerrando Slot PiP...");
    stopSlotPlayer("pip");
    appState.slotsData["pip"] = null;
    appState.pipMode = false;

    syncActiveButtonsInMenu();
    updateSlotsLayout();
}

// ── UTILERÍAS DE ROLES VISUALES DINÁMICOS DE SLOTS (SEAMLESS REORDERING) ──
function stopSlotPlayer(slotId) {
    console.log(`[Seamless] Limpiando reproductor físico del slot: ${slotId}`);
    const videoEl = document.getElementById(`tv-video-player-${slotId}`);
    const iframeEl = document.getElementById(`tv-iframe-player-${slotId}`);

    if (videoEl) {
        videoEl.pause();
        videoEl.src = "";
        videoEl.removeAttribute("src");
        try {
            videoEl.load();
        } catch (e) {}
    }
    if (iframeEl) {
        iframeEl.src = "about:blank";
        iframeEl.removeAttribute("srcdoc");
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

    if (leftSlot) {
        leftSlot.style.width = leftWidth;
    }
    if (rightSlot) {
        rightSlot.style.width = rightWidth;
    }
}

function updateSlotsLayout() {
    const s1 = appState.slotsData["1"];
    const s2 = appState.slotsData["2"];
    const sp = appState.slotsData["pip"];

    const slot1El = document.getElementById("player-slot-1");
    const slot2El = document.getElementById("player-slot-2");
    const slotPipEl = document.getElementById("player-slot-pip");
    const resizerEl = dom.splitResizer;
    const wrapperEl = dom.playerWrapper;

    if (!slot1El || !slot2El || !slotPipEl) return;

    console.log("[Seamless] Actualizando roles CSS de slots:", { s1: !!s1, s2: !!s2, sp: !!sp });

    // Limpiar clases de rol previas
    const rolesClasses = ["slot-role-single", "slot-role-left", "slot-role-right", "slot-role-pip", "slot-role-hidden"];
    [slot1El, slot2El, slotPipEl].forEach(el => {
        rolesClasses.forEach(cls => el.classList.remove(cls));
        el.style.width = ""; // Reset de anchos en línea
    });

    // Caso 1: Los 3 slots tienen datos activos
    if (s1 && s2 && sp) {
        slot1El.classList.add("slot-role-left");
        slot2El.classList.add("slot-role-right");
        slotPipEl.classList.add("slot-role-pip");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        
        applySplitWidths();
    }
    // Caso 2: Solo Slot 1 y Slot 2 activos
    else if (s1 && s2) {
        slot1El.classList.add("slot-role-left");
        slot2El.classList.add("slot-role-right");
        slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        
        applySplitWidths();
    }
    // Caso 3: Solo Slot 1 y PiP activos (se verán en split-screen)
    else if (s1 && sp) {
        slot1El.classList.add("slot-role-left");
        slot2El.classList.add("slot-role-hidden");
        slotPipEl.classList.add("slot-role-right");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        
        applySplitWidths();
    }
    // Caso 4: Solo Slot 2 y PiP activos (se verán en split-screen - tras cerrar 1)
    else if (s2 && sp) {
        slot1El.classList.add("slot-role-hidden");
        slot2El.classList.add("slot-role-left");
        slotPipEl.classList.add("slot-role-right");
        if (wrapperEl) wrapperEl.classList.add("split-mode");
        if (resizerEl) resizerEl.style.display = "flex";
        
        applySplitWidths();
    }
    // Caso 5: Solo Slot 1 activo
    else if (s1) {
        slot1El.classList.add("slot-role-single");
        slot2El.classList.add("slot-role-hidden");
        slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    }
    // Caso 6: Solo Slot 2 activo
    else if (s2) {
        slot1El.classList.add("slot-role-hidden");
        slot2El.classList.add("slot-role-single");
        slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    }
    // Caso 7: Solo PiP activo
    else if (sp) {
        slot1El.classList.add("slot-role-hidden");
        slot2El.classList.add("slot-role-hidden");
        slotPipEl.classList.add("slot-role-single");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    }
    // Caso 8: Ninguno activo
    else {
        slot1El.classList.add("slot-role-hidden");
        slot2El.classList.add("slot-role-hidden");
        slotPipEl.classList.add("slot-role-hidden");
        if (wrapperEl) wrapperEl.classList.remove("split-mode");
        if (resizerEl) resizerEl.style.display = "none";
    }

    // Aplicar dimensiones de PiP si corresponde
    if (slotPipEl.classList.contains("slot-role-pip")) {
        applyPipSize();
    } else {
        slotPipEl.style.removeProperty("--pip-width");
        slotPipEl.style.removeProperty("--pip-height");
    }

    // Actualizar el título principal y categoría basados en las pantallas activas
    let titles = [];
    if (s1) titles.push(s1.title);
    if (s2) titles.push(s2.title);
    if (sp) {
        if (!slotPipEl.classList.contains("slot-role-pip")) {
            titles.push(sp.title);
        }
    }
    
    if (titles.length > 0) {
        dom.playingTitle.textContent = titles.join(" | ");
        const mainSlot = s1 || s2 || sp;
        if (mainSlot) {
            dom.playingGroup.textContent = mainSlot.group;
        }
    } else {
        dom.playingTitle.textContent = "Ningún evento seleccionado";
        dom.playingGroup.textContent = "Elige una transmisión de la parte superior para comenzar";
    }

    updateFullscreenButtonVisibility();
    rebuildSpatialIndexes();
}

function syncActiveButtonsInMenu() {
    const container = dom.eventsList;
    if (!container) return;

    const url1 = appState.slotsData["1"] ? appState.slotsData["1"].url : appState.currentPlayingUrl;
    const url2 = appState.slotsData["2"] ? appState.slotsData["2"].url : null;
    const urlPip = appState.slotsData["pip"] ? appState.slotsData["pip"].url : null;

    container.querySelectorAll(".event-stream-btn").forEach(btn => {
        const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
        if (url1 && pageUrl === url1) {
            btn.classList.add("active-play");
            appState.activeBtn = btn;
        } else {
            btn.classList.remove("active-play");
        }
    });

    container.querySelectorAll(".btn-action-split").forEach(btn => {
        const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
        if (url2 && pageUrl === url2) {
            btn.classList.add("active-play");
        } else {
            btn.classList.remove("active-play");
        }
    });

    container.querySelectorAll(".btn-action-pip").forEach(btn => {
        const pageUrl = decodeURIComponent(btn.dataset.pageUrl);
        if (urlPip && pageUrl === urlPip) {
            btn.classList.add("active-play");
        } else {
            btn.classList.remove("active-play");
        }
    });
}

// Funciones helper para alternar pantalla completa nativa del navegador
function requestBrowserFullscreen() {
    const el = dom.appContainer || document.querySelector(".tv-app-container") || document.documentElement;
    if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => {
            console.warn("Fullscreen request failed on appContainer, trying documentElement:", err);
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err2 => console.error("DocumentElement fullscreen failed:", err2));
            }
        });
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
}

function exitBrowserFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn("Fullscreen exit failed:", err));
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// ── CONTROL DE VISIBILIDAD DE MENÚ (PANTALLA COMPLETA INTERACTIVA) ──
function setMenuHidden(hidden) {
    if (appState.menuHidden === hidden) return;

    appState.menuHidden = hidden;

    if (hidden) {
        dom.eventsSection.classList.add("hidden");
        if (dom.btnFullscreenToggle) {
            dom.btnFullscreenToggle.textContent = "📺";
        }
        // Desenfocar elemento actual para que el foco no interfiera
        if (activeFocusedElement) {
            activeFocusedElement.blur();
        }

        // Activar pantalla completa nativa en el navegador si no está activa
        const isBrowserFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
        if (!isBrowserFullscreen) {
            requestBrowserFullscreen();
        }
    } else {
        dom.eventsSection.classList.remove("hidden");
        if (dom.btnFullscreenToggle) {
            dom.btnFullscreenToggle.textContent = "⛶";
        }

        // Recuperar el foco en el último botón activo o en el primero disponible
        setTimeout(() => {
            if (appState.activeBtn) {
                setFocus(appState.activeBtn);
            } else {
                const firstBtn = dom.eventsList.querySelector(".event-stream-btn");
                if (firstBtn) setFocus(firstBtn);
            }
        }, 150);

        // Salir de pantalla completa nativa en el navegador si está activa
        const isBrowserFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
        if (isBrowserFullscreen) {
            exitBrowserFullscreen();
        }
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

    // Lógica para ajustar el ancho con el D-pad cuando el divisor de pantalla partida está enfocado
    if (activeFocusedElement === dom.splitResizer) {
        if (key === "ArrowLeft" || key === "ArrowRight") {
            e.preventDefault();
            const wrapper = dom.playerWrapper;
            if (wrapper) {
                let currentWidth = parseFloat(wrapper.dataset.splitWidthLeft) || 50;
                const step = 3; // Modificar en pasos de 3%
                if (key === "ArrowLeft") {
                    currentWidth -= step;
                } else {
                    currentWidth += step;
                }
                if (currentWidth < 20) currentWidth = 20;
                if (currentWidth > 80) currentWidth = 80;
                wrapper.dataset.splitWidthLeft = `${currentWidth}%`;
                applySplitWidths();
            }
            return;
        }
    }

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

/**
 * Controla la visualización del botón de pantalla completa.
 * Solo se muestra si hay más de una transmisión activa (Split screen o PiP).
 */
function updateFullscreenButtonVisibility() {
    const btn = dom.btnFullscreenToggle;
    if (!btn) return;

    btn.style.display = "inline-block";
    rebuildSpatialIndexes();
}

// ── SISTEMA DE AUDIO DIVIDIDO (WEB AUDIO API) ──
let audioCtx = null;
let audioSources = {
    slot1: null,
    slot2: null
};
let audioPanners = {
    slot1: null,
    slot2: null
};

async function initWebAudio() {
    if (audioCtx) {
        if (audioCtx.state === "suspended") {
            await audioCtx.resume();
        }
        return true;
    }

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        if (audioCtx.state === "suspended") {
            await audioCtx.resume();
        }

        // Crear los panners globales
        if (audioCtx.createStereoPanner) {
            audioPanners.slot1 = audioCtx.createStereoPanner();
            audioPanners.slot2 = audioCtx.createStereoPanner();
        } else {
            audioPanners.slot1 = audioCtx.createPanner();
            audioPanners.slot1.panningModel = 'HRTF';
            audioPanners.slot2 = audioCtx.createPanner();
            audioPanners.slot2.panningModel = 'HRTF';
        }

        // Conectar los panners al destino de audio (altavoces)
        audioPanners.slot1.connect(audioCtx.destination);
        audioPanners.slot2.connect(audioCtx.destination);

        // Inicialmente en estéreo centrado (pan = 0)
        resetPannerValue(audioPanners.slot1, 0);
        resetPannerValue(audioPanners.slot2, 0);

        // Conectar los elementos de video actuales si ya existen en el DOM
        const video1 = document.getElementById("tv-video-player-1");
        const video2 = document.getElementById("tv-video-player-2");
        if (video1) connectVideoToWebAudio("1", video1);
        if (video2) connectVideoToWebAudio("2", video2);

        console.log("Web Audio API inicializado correctamente y panners globales conectados.");
        return true;
    } catch (e) {
        console.error("Error al inicializar Web Audio API:", e);
        return false;
    }
}

function resetPannerValue(panner, value) {
    if (!panner) return;
    if (panner.pan) {
        panner.pan.value = value;
    } else {
        panner.setPosition(value, 0, 0);
    }
}

function connectVideoToWebAudio(slotId, videoEl) {
    if (!audioCtx) return; // Se conectará después cuando se inicialice el contexto

    try {
        const key = `slot${slotId}`;
        
        // Si ya hay una fuente previa conectada, intentar desconectarla
        if (audioSources[key]) {
            try {
                audioSources[key].disconnect();
            } catch(err){}
        }

        // Crear nueva fuente para la nueva instancia del elemento de video
        const source = audioCtx.createMediaElementSource(videoEl);
        source.connect(audioPanners[key]);
        audioSources[key] = source;

        // Si el audio dividido está activo, aplicar el balance correspondiente de inmediato
        if (appState.audioSplit) {
            const panVal = slotId === "1" ? -1 : 1;
            resetPannerValue(audioPanners[key], panVal);
        } else {
            resetPannerValue(audioPanners[key], 0);
        }
        
        console.log(`[Slot ${slotId}] Video conectado exitosamente a la Web Audio API.`);
    } catch (e) {
        console.error(`Error al conectar video de slot ${slotId} a Web Audio API:`, e);
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
    if (!appState.splitMode) {
        console.warn("Audio dividido solo disponible en modo pantalla partida.");
        return;
    }

    const initialized = await initWebAudio();
    if (!initialized) return;

    const video2 = document.getElementById("tv-video-player-2");
    if (!video2) return;

    appState.audioSplit = !appState.audioSplit;

    if (appState.audioSplit) {
        console.log("Activando audio dividido L/R...");
        
        resetPannerValue(audioPanners.slot1, -1);
        resetPannerValue(audioPanners.slot2, 1);

        // Des-silenciar el reproductor 2
        video2.muted = false;

        if (dom.btnAudioSplit) {
            dom.btnAudioSplit.classList.add("active-play");
        }
    } else {
        console.log("Desactivando audio dividido...");

        resetPannerValue(audioPanners.slot1, 0);
        resetPannerValue(audioPanners.slot2, 0);

        // Volver a silenciar el reproductor 2
        video2.muted = true;

        if (dom.btnAudioSplit) {
            dom.btnAudioSplit.classList.remove("active-play");
        }
    }
}

// ── MANEJADOR DE RESIZER EN PANTALLA PARTIDA ──
let isDraggingResizer = false;

function setupSplitResizerEvents() {
    const resizer = dom.splitResizer;
    const wrapper = dom.playerWrapper;
    const overlay = document.getElementById("iframe-drag-overlay");

    if (!resizer || !wrapper) return;

    const startDrag = (e) => {
        e.preventDefault();
        isDraggingResizer = true;
        resizer.classList.add("focused");
        if (overlay) {
            overlay.style.display = "block";
        }
    };

    const doDrag = (e) => {
        if (!isDraggingResizer) return;

        let clientX = 0;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const xRelative = clientX - wrapperRect.left;
        let percentage = (xRelative / wrapperRect.width) * 100;

        // Limitar entre 20% y 80%
        if (percentage < 20) percentage = 20;
        if (percentage > 80) percentage = 80;

        wrapper.dataset.splitWidthLeft = `${percentage}%`;
        applySplitWidths();
    };

    const stopDrag = () => {
        if (isDraggingResizer) {
            isDraggingResizer = false;
            resizer.classList.remove("focused");
            if (overlay) {
                overlay.style.display = "none";
            }
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

// Helper para convertir la hora del JSON (UTC-5) a un objeto Date local del navegador
function getEventLocalDate(evTime) {
    if (!evTime) return null;
    try {
        const timeParts = evTime.split(":");
        if (timeParts.length === 2) {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            // wc.json asume por defecto la zona horaria UTC-5
            const isoStr = `${year}-${month}-${day}T${timeParts[0]}:${timeParts[1]}:00-05:00`;
            return new Date(isoStr);
        }
    } catch (e) {
        console.warn("Error parseando fecha de evento:", e);
    }
    return null;
}

// ── AUTO-REPRODUCCIÓN INTELIGENTE MULTI-PANTALLA ──
function autoPlayIntelligent(events, container) {
    if (!events || events.length === 0) return;

    const now = new Date();

    // 1. Filtrar eventos que tengan links y NO hayan finalizado (según marcadores de La Cancha o tiempo transcurrido)
    const nonFinishedEvents = events.filter(ev => {
        if (!ev.links || ev.links.length === 0) return false;

        // Comprobar estado en marcadores de La Cancha
        const match = findMatchingMatch(ev.title, appState.scores);
        if (match && match.status === "finished") {
            return false;
        }

        // Si no hay match de La Cancha, usamos el tiempo transcurrido como salvaguarda:
        // Si ya pasaron más de 150 minutos (2.5 horas) desde su hora programada de inicio, asumimos finalizado.
        const eventDate = getEventLocalDate(ev.time);
        if (eventDate) {
            const diffMinutes = (now - eventDate) / (1000 * 60);
            if (diffMinutes > 150) {
                return false;
            }
        }
        return true;
    });

    if (nonFinishedEvents.length === 0) {
        console.log("[AutoPlay] Todos los eventos disponibles han finalizado o no tienen enlaces.");
        return;
    }

    // 2. Buscar eventos que estén activamente en vivo (jugándose ahora según La Cancha o dentro de su ventana temporal de transmisión)
    const activeEvents = nonFinishedEvents.filter(ev => {
        const match = findMatchingMatch(ev.title, appState.scores);
        // Si La Cancha dice explícitamente que está en juego
        if (match && (match.status === "live" || match.status === "in_play" || match.time_elapsed)) {
            return true;
        }
        // Si no hay match o está programado, pero la hora actual cae en la ventana activa (desde 10 min antes hasta 150 min después)
        const eventDate = getEventLocalDate(ev.time);
        if (eventDate) {
            const diffMinutes = (now - eventDate) / (1000 * 60);
            return (diffMinutes >= -10 && diffMinutes <= 150);
        }
        return false;
    });

    let targetEvents = [];
    let refTime = "";

    if (activeEvents.length > 0) {
        // Prioridad: reproducir los que estén activos en el bloque de tiempo actual
        refTime = activeEvents[0].time;
        targetEvents = activeEvents.filter(e => e.time === refTime);
        console.log(`[AutoPlay] Priorizando transmisiones activas para las ${refTime} (${targetEvents.length} encontrados)`);
    } else {
        // Fallback: reproducir el primer bloque de eventos programados futuros que no han finalizado
        refTime = nonFinishedEvents[0].time;
        targetEvents = nonFinishedEvents.filter(e => e.time === refTime);
        console.log(`[AutoPlay] No hay eventos activos en este instante. Cargando próximos eventos programados para las ${refTime} (${targetEvents.length} encontrados)`);
    }

    if (targetEvents.length === 0) return;

    if (targetEvents.length === 1) {
        const ev1 = targetEvents[0];
        const lk1 = ev1.links[0];
        const pageUrl = lk1.url;
        const streamName = `${ev1.title} — ${lk1.server}`;

        // Marcar botón en el DOM
        const btn1 = container.querySelector(`.event-stream-btn[data-page-url="${encodeURIComponent(pageUrl)}"]`);
        if (btn1) {
            appState.activeBtn = btn1;
            btn1.classList.add("active-play");
        }

        console.log(`[AutoPlay] Reproduciendo 1 canal: ${streamName}`);
        playStream(pageUrl, streamName, ev1.category, true);
    } 
    else if (targetEvents.length === 2) {
        const ev1 = targetEvents[0];
        const lk1 = ev1.links[0];
        const ev2 = targetEvents[1];
        const lk2 = ev2.links[0];

        // Marcar botones en el DOM
        const btn1 = container.querySelector(`.event-stream-btn[data-page-url="${encodeURIComponent(lk1.url)}"]`);
        if (btn1) {
            appState.activeBtn = btn1;
            btn1.classList.add("active-play");
        }
        const btn2 = container.querySelector(`.btn-action-split[data-page-url="${encodeURIComponent(lk2.url)}"]`);
        if (btn2) {
            btn2.classList.add("active-play");
        }

        console.log(`[AutoPlay] Reproduciendo pantalla partida (2 canales): ${ev1.title} + ${ev2.title}`);
        // Reproducir Slot 1 principal
        playStream(lk1.url, `${ev1.title} — ${lk1.server}`, ev1.category, true);
        // Reproducir Slot 2 (Split)
        enableSplitScreen(lk2.url, `${ev2.title} — ${lk2.server}`, ev2.category, true);
    } 
    else if (targetEvents.length >= 3) {
        const ev1 = targetEvents[0];
        const lk1 = ev1.links[0];
        const ev2 = targetEvents[1];
        const lk2 = ev2.links[0];
        const ev3 = targetEvents[2];
        const lk3 = ev3.links[0];

        // Marcar botones en el DOM
        const btn1 = container.querySelector(`.event-stream-btn[data-page-url="${encodeURIComponent(lk1.url)}"]`);
        if (btn1) {
            appState.activeBtn = btn1;
            btn1.classList.add("active-play");
        }
        const btn2 = container.querySelector(`.btn-action-split[data-page-url="${encodeURIComponent(lk2.url)}"]`);
        if (btn2) {
            btn2.classList.add("active-play");
        }
        const btn3 = container.querySelector(`.btn-action-pip[data-page-url="${encodeURIComponent(lk3.url)}"]`);
        if (btn3) {
            btn3.classList.add("active-play");
        }

        console.log(`[AutoPlay] Reproduciendo Multi-View (3 canales): ${ev1.title} + ${ev2.title} + ${ev3.title}`);
        // Reproducir Slot 1 principal
        playStream(lk1.url, `${ev1.title} — ${lk1.server}`, ev1.category, true);
        // Reproducir Slot 2 (Split)
        enableSplitScreen(lk2.url, `${ev2.title} — ${lk2.server}`, ev2.category, true);
        // Reproducir Slot PiP (Flotante)
        enablePipScreen(lk3.url, `${ev3.title} — ${lk3.server}`, ev3.category, true);
    }
}
