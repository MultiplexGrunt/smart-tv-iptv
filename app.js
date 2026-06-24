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
    pipCorner: "pip-top-right",
    scores: []                  // Almacén de marcadores deportivos en tiempo real
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
    appContainer: document.querySelector(".tv-app-container"),
    closeBtn1: document.getElementById("btn-close-slot-1"),
    closeBtn2: document.getElementById("btn-close-slot-2"),
    closeBtnPip: document.getElementById("btn-close-slot-pip"),
    btnFullscreenToggle: document.getElementById("btn-fullscreen-toggle"),
    positionBtnPip: document.getElementById("btn-position-slot-pip")
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

    // Manejo de botones de cerrar ranuras
    if (dom.closeBtn1) {
        dom.closeBtn1.addEventListener("click", (e) => {
            e.stopPropagation();
            stopMainPlayer();
        });
    }
    if (dom.closeBtn2) {
        dom.closeBtn2.addEventListener("click", (e) => {
            e.stopPropagation();
            disableSplitScreen();
        });
    }
    if (dom.closeBtnPip) {
        dom.closeBtnPip.addEventListener("click", (e) => {
            e.stopPropagation();
            disablePipScreen();
        });
    }
    if (dom.positionBtnPip) {
        dom.positionBtnPip.addEventListener("click", (e) => {
            e.stopPropagation();
            cyclePipCorner();
        });
    }
    if (dom.btnFullscreenToggle) {
        dom.btnFullscreenToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            setMenuHidden(true);
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
        ["colombia", "rd del congo"],
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
async function playStreamInSlot(slotId, url, title, group, forceIframe, isMuted = false) {
    console.log(`[Slot ${slotId}] Reproduciendo: ${title} -> ${url} (forceIframe=${forceIframe}, isMuted=${isMuted})`);

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
    } catch (e) { }

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

// Detener por completo la reproducción en el Slot 1 (Principal)
function stopMainPlayer() {
    console.log("Deteniendo reproductor principal...");

    // Si estaba activa la pantalla partida, la removemos
    if (appState.splitMode) {
        disableSplitScreen();
    }

    // Si estaba activo el PiP, lo removemos
    if (appState.pipMode) {
        disablePipScreen();
    }

    appState.currentPlayingUrl = "";
    dom.playingTitle.textContent = "Ningún evento seleccionado";
    dom.playingGroup.textContent = "Elige una transmisión de la parte superior para comenzar";
    dom.playingGroup.style.color = "var(--text-muted)";
    dom.playerLoader.style.display = "none";

    const videoEl1 = document.getElementById("tv-video-player-1");
    const iframeEl1 = document.getElementById("tv-iframe-player-1");

    if (videoEl1) {
        videoEl1.pause();
        videoEl1.src = "";
        videoEl1.removeAttribute("src");
        try {
            videoEl1.load();
        } catch (e) { }
    }
    if (iframeEl1) {
        iframeEl1.src = "about:blank";
        iframeEl1.removeAttribute("srcdoc");
    }

    if (appState.hlsPlayer1) {
        appState.hlsPlayer1.destroy();
        appState.hlsPlayer1 = null;
    }

    // Remover marcas de canal activo en las listas
    const container = dom.eventsList;
    if (container) {
        container.querySelectorAll(".event-stream-btn.active-play").forEach(btn => {
            btn.classList.remove("active-play");
        });
    }
    appState.activeBtn = null;
    updateFullscreenButtonVisibility();
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

    updateFullscreenButtonVisibility();
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
        iframeEl2.removeAttribute("srcdoc");
    }

    if (appState.hlsPlayer2) {
        appState.hlsPlayer2.destroy();
        appState.hlsPlayer2 = null;
    }
    updateFullscreenButtonVisibility();
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

    updateFullscreenButtonVisibility();
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
        iframeElPip.removeAttribute("srcdoc");
    }

    if (appState.hlsPlayerPip) {
        appState.hlsPlayerPip.destroy();
        appState.hlsPlayerPip = null;
    }
    updateFullscreenButtonVisibility();
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

/**
 * Controla la visualización del botón de pantalla completa.
 * Solo se muestra si hay más de una transmisión activa (Split screen o PiP).
 */
function updateFullscreenButtonVisibility() {
    const btn = dom.btnFullscreenToggle;
    if (!btn) return;

    const hasMultipleActive = appState.splitMode || appState.pipMode;
    if (hasMultipleActive) {
        btn.style.display = "inline-block";
    } else {
        btn.style.display = "none";

        // Si el botón tenía el foco y se oculta, devolver el foco a un canal
        if (activeFocusedElement === btn) {
            const firstBtn = dom.eventsList.querySelector(".event-stream-btn");
            if (firstBtn) setFocus(firstBtn);
        }
    }
    rebuildSpatialIndexes();
}
