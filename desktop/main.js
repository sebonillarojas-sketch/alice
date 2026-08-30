const path = require("path");
const {
  app, BrowserWindow, Tray, Menu, Notification,
  ipcMain, powerMonitor, shell, nativeImage,
} = require("electron");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://alice.bam.pe";
const APP_HOST = "alice.bam.pe";
const OFFLINE_FILE = path.join(__dirname, "offline.html");

let win = null;
let tray = null;
let saliendo = false;

// `shell.openExternal` entrega la URL tal cual al manejador de esquemas del
// sistema operativo. Si dejáramos pasar cualquier protocolo, una página (o un
// origin ajeno que haya quedado cargado por error) podría hacer que el SO abra
// un esquema custom registrado en la Mac, o incluso `file:`, con los privilegios
// del proceso que lo invoca. Restringimos a http/https/mailto/tel: los primeros
// dos son "abrir en el navegador", y los otros dos los maneja el sistema de
// forma segura (Mail.app, FaceTime/teléfono) y la web los usa de verdad — el
// botón de enviar reporte por email hace `window.location.href = "mailto:…"`, y
// sin esto la acción se traga en silencio dentro del shell. Todo lo demás
// (file:, esquemas custom) sigue bloqueado. Una sola función, usada en los dos
// lugares donde decidimos si algo es seguro para el navegador del sistema.
function esUrlExternaSegura(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:"
      || u.protocol === "mailto:" || u.protocol === "tel:";
  } catch {
    return false;
  }
}

// El preload expone `window.alice` (notify/onResume/onOpen) a lo que sea que
// esté cargado en el frame principal. Si ese frame navegara a un origin ajeno
// (un link mal armado, un redirect, lo que sea), ese origin quedaría con el
// puente del shell activo — la superficie de notificaciones expuesta a
// contenido no confiable. Por eso solo consideramos "propio" a alice.bam.pe y a
// nuestra propia pantalla offline; cualquier otra cosa no es una navegación
// legítima del frame principal.
function esOrigenPermitido(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && u.hostname === APP_HOST) return true;
    if (u.protocol === "file:" && decodeURIComponent(u.pathname) === OFFLINE_FILE) return true;
    return false;
  } catch {
    return false;
  }
}

function crearVentana() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "ALICE",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Explícito aunque hoy coincida con el default de Electron: esta ventana
      // carga contenido remoto (alice.bam.pe), y el sandbox del renderer es la
      // barrera más importante que tenemos contra ese contenido. Los demás
      // flags de seguridad ya están afirmados acá; que este dependiera de un
      // default que puede cambiar entre versiones era la excepción, no la regla.
      sandbox: true,
      // Electron lo trae en true por defecto y estrangula los timers de las
      // ventanas ocultas. Sin esto, "notifica con la ventana cerrada" se degrada
      // de formas raras y difíciles de diagnosticar.
      backgroundThrottling: false,
    },
  });

  win.loadURL(APP_URL);
  win.once("ready-to-show", () => win.show());

  // Sin red o con Netlify caído, Chromium muestra una página en blanco y la app
  // parece rota. La pantalla de fallback dice cuál de las dos fallas está pasando.
  win.webContents.on("did-fail-load", (_e, code, desc, _url, esPrincipal) => {
    if (!esPrincipal) return;
    // ERR_ABORTED (-3) no es una falla de red: Chromium lo emite ante abortos
    // normales, como el "Recargar" del tray disparado mientras había una carga
    // en curso, o cualquier navegación cancelada. Tratarlo como offline le
    // muestra "sin conexión" a alguien con la red perfecta y le tira el estado
    // del renderer a la basura.
    if (code === -3) return;
    win.loadFile(OFFLINE_FILE, {
      query: { code: String(code), desc: desc || "" },
    });
  });

  // Cerrar oculta, no cierra: es lo que mantiene vivos el renderer y su WebSocket,
  // y por lo tanto lo que hace verdad "notifica con el navegador cerrado".
  win.on("close", (e) => {
    if (saliendo) return;
    e.preventDefault();
    win.hide();
  });

  // `setWindowOpenHandler` solo cubre ventanas nuevas (target=_blank, window.open):
  // no alcanza para bloquear una navegación normal del frame principal a otro
  // dominio. Por eso interceptamos también `will-navigate`. Ni uno ni otro
  // aplican a `win.loadURL`/`win.loadFile` llamados desde este mismo proceso
  // (la carga inicial de alice.bam.pe y el fallback a offline.html): Electron
  // solo emite estos eventos para navegación iniciada por el contenido de la
  // página, no por el proceso principal, así que la carga legítima no se ve
  // afectada.
  win.webContents.on("will-navigate", (e, url) => {
    if (esOrigenPermitido(url)) return; // alice.bam.pe u offline.html: legítimo
    e.preventDefault();
    if (esUrlExternaSegura(url)) shell.openExternal(url);
  });

  // Los enlaces externos van al navegador del sistema, no abren ventanas de Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (esUrlExternaSegura(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function mostrarVentana() {
  if (!win) return crearVentana();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function crearTray() {
  // Ícono vacío + título de texto: en macOS alcanza y evita meter un binario al
  // repo. Un ícono template propio es cosmético y puede venir después.
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("◐");
  tray.setToolTip("ALICE");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir ALICE", click: mostrarVentana },
    { label: "Recargar", click: () => win && win.loadURL(APP_URL) },
    { type: "separator" },
    { label: "Salir", click: () => { saliendo = true; app.quit(); } },
  ]));
  tray.on("click", mostrarVentana);
}

// Una sola instancia: abrir la app dos veces enfoca la que ya está corriendo.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrarVentana);

  app.whenReady().then(() => {
    crearVentana();
    crearTray();

    app.setLoginItemSettings({ openAtLogin: true });

    // Al despertar, el WebSocket de Realtime ya se murió en silencio. La web hace
    // la consulta de recuperación cuando recibe este aviso.
    powerMonitor.on("resume", () => {
      if (win) win.webContents.send("alice:resume");
    });

    app.on("activate", mostrarVentana);

    // Chequea al arrancar y cada 6 horas. La app vive días en la barra de menú,
    // así que un solo chequeo al inicio dejaría versiones viejas corriendo semanas.
    //
    // El .catch() no es opcional: ante cualquier falla (sin red, DNS, o un 404
    // porque todavía no existe ningún release publicado en GitHub) electron-updater
    // relanza el error y la promesa queda rechazada. Como la app arranca al login,
    // esto puede dispararse en cada arranque — y mientras no haya un release
    // publicado (bloqueado hasta tener cuenta de Apple Developer y notarización),
    // se va a disparar siempre. Es esperable y benigno: no lo interpreten como un
    // bug ni lo saquen.
    const avisarFalloDeUpdate = (err) => {
      console.warn(
        "[autoUpdater] chequeo de actualización falló (esperable sin red o " +
        "mientras no haya un release publicado en GitHub Releases):",
        err?.message || err,
      );
    };
    autoUpdater.checkForUpdatesAndNotify().catch(avisarFalloDeUpdate);
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(avisarFalloDeUpdate);
    }, 6 * 60 * 60 * 1000);
  });
}

// No salir al cerrar la última ventana: la app vive en la barra de menú.
app.on("window-all-closed", () => {});
app.on("before-quit", () => { saliendo = true; });

ipcMain.on("alice:notify", (_e, banner) => {
  if (!Notification.isSupported() || !banner?.title) return;

  const n = new Notification({ title: banner.title, body: banner.body || "" });
  n.on("click", () => {
    mostrarVentana();
    // Le mandamos el destino a la web y ella navega. No ejecutamos JS en la página.
    if (banner.deepLink && win) win.webContents.send("alice:open", banner.deepLink);
  });
  n.show();
});
