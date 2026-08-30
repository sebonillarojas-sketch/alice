const path = require("path");
const {
  app, BrowserWindow, Tray, Menu, Notification,
  ipcMain, powerMonitor, shell, nativeImage,
} = require("electron");

const APP_URL = "https://alice.bam.pe";

let win = null;
let tray = null;
let saliendo = false;

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
    win.loadFile(path.join(__dirname, "offline.html"), {
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

  // Los enlaces externos van al navegador del sistema, no abren ventanas de Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
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
