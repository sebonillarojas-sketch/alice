// Dropbox · dos modos, mismo contrato:
//  - API (default): OAuth con refresh token (los access tokens vencen a las 4h).
//    Es el modo de Railway/producción.
//  - local (DROPBOX_MODE=local + DROPBOX_LOCAL_ROOT): la app de Dropbox de la
//    máquina mantiene el team space sincronizado en disco y acá se opera el
//    filesystem directo — sin tokens ni rate limits; el sync con el equipo lo
//    hace la app. Los paths siguen siendo estilo API ("/Hygge/...") relativos
//    a la raíz del equipo, así todos los consumidores quedan iguales.
import dotenv from "dotenv";
dotenv.config();
import { query } from "../db.js";
import { promises as fs, existsSync } from "fs";
import nodePath from "path";

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

const LOCAL_MODE = process.env.DROPBOX_MODE === "local";
const LOCAL_ROOT = process.env.DROPBOX_LOCAL_ROOT ? nodePath.resolve(process.env.DROPBOX_LOCAL_ROOT) : "";

function getDropboxRefreshToken() {
  if (process.env.DROPBOX_REFRESH_TOKEN) return process.env.DROPBOX_REFRESH_TOKEN;
  try {
    const { rows } = query("SELECT value FROM app_settings WHERE key = 'dropbox_refresh_token'");
    return rows[0]?.value || null;
  } catch { return null; }
}

let _dbxToken = null, _dbxExpiry = 0, _rootNs = null;
export function clearDropboxTokenCache() { _dbxToken = null; _dbxExpiry = 0; _rootNs = null; }

// Cuenta de equipo: los paths (/Hygge/...) viven en el team space, no en el home
// namespace del miembro. Hay que resolver contra la raíz del equipo vía este header,
// o la API devuelve 400. Se cachea el root namespace del token actual.
async function getRootNamespace(token) {
  if (_rootNs !== null) return _rootNs;
  try {
    const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    _rootNs = data?.root_info?.root_namespace_id || "";
  } catch { _rootNs = ""; }
  return _rootNs;
}
async function pathRootHeader(token) {
  const ns = await getRootNamespace(token);
  return ns ? { "Dropbox-API-Path-Root": JSON.stringify({ ".tag": "root", root: ns }) } : {};
}

async function getToken() {
  // Refresh token (permanente) → access token fresco
  const refresh = getDropboxRefreshToken();
  if (refresh && APP_KEY && APP_SECRET) {
    if (_dbxToken && Date.now() < _dbxExpiry - 60000) return _dbxToken;
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: APP_KEY,
        client_secret: APP_SECRET,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Dropbox OAuth error: ${data.error_description || data.error}`);
    _dbxToken = data.access_token;
    _dbxExpiry = Date.now() + (data.expires_in || 14400) * 1000;
    return _dbxToken;
  }
  // Legacy: token directo (vence a las 4h — solo como fallback)
  if (process.env.DROPBOX_ACCESS_TOKEN) return process.env.DROPBOX_ACCESS_TOKEN;
  throw new Error("Dropbox no conectado — autorizar en https://aliceai.bam.pe/auth/dropbox");
}

async function dbxFetch(path, body) {
  const token = await getToken();
  const res = await fetch(`https://api.dropboxapi.com/2${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(await pathRootHeader(token)) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    let summary = txt;
    try { summary = JSON.parse(txt).error_summary || txt; } catch {}
    throw new Error(`Dropbox error ${res.status}: ${summary || "(sin detalle)"}`);
  }
  return res.json();
}

const apiDropbox = {
  search: async ({ query, path = "", maxResults = 10 }) => {
    const data = await dbxFetch("/files/search_v2", {
      query,
      options: { path: path || "", max_results: maxResults, file_status: "active" },
    });
    return (data.matches || []).map(m => ({
      name:        m.metadata?.metadata?.name,
      path:        m.metadata?.metadata?.path_display,
      type:        m.metadata?.metadata?.[".tag"],
      modified:    m.metadata?.metadata?.client_modified,
      size:        m.metadata?.metadata?.size,
    }));
  },

  getFileContent: async (filePath) => {
    const token = await getToken();
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
        ...(await pathRootHeader(token)),
      },
    });
    if (!res.ok) throw new Error(`Dropbox download error ${res.status}: ${await res.text()}`);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("utf8");
  },

  // Igual que getFileContent pero devuelve el Buffer binario intacto
  // (necesario para .xlsx/.xls, que son ZIPs y se corrompen si se decodifican a UTF-8).
  getFileBuffer: async (filePath) => {
    const token = await getToken();
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
        ...(await pathRootHeader(token)),
      },
    });
    if (!res.ok) throw new Error(`Dropbox download error ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  },

  listFolder: async (path = "") => {
    const data = await dbxFetch("/files/list_folder", { path, limit: 50 });
    return (data.entries || []).map(e => ({
      name:     e.name,
      path:     e.path_display,
      type:     e[".tag"],
      modified: e.client_modified,
      size:     e.size,
    }));
  },

  createFolder: async (path) => {
    return dbxFetch("/files/create_folder_v2", { path, autorename: false });
  },

  moveFile: async (fromPath, toPath) => {
    const data = await dbxFetch("/files/move_v2", { from_path: fromPath, to_path: toPath, autorename: true });
    return data.metadata;
  },

  deleteFolder: async (path) => {
    return dbxFetch("/files/delete_v2", { path });
  },

  // content: string UTF-8 o Buffer binario (PDFs/imágenes de WhatsApp)
  uploadFile: async (path, content, { mode = "overwrite", autorename = false } = {}) => {
    const token = await getToken();
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path, mode, autorename, mute: true }),
        "Content-Type": "application/octet-stream",
        ...(await pathRootHeader(token)),
      },
      body: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    });
    if (!res.ok) {
      const txt = await res.text();
      let summary = txt;
      try { summary = JSON.parse(txt).error_summary || txt; } catch {}
      throw new Error(`Dropbox upload error ${res.status}: ${summary || "(sin detalle)"}`);
    }
    return res.json();
  },
};

// ── Modo local · filesystem contra la carpeta que sincroniza la app ──────────

// Basura de macOS/Dropbox que no es contenido del equipo
const FS_IGNORE = new Set([".DS_Store", ".dropbox", ".dropbox.cache", "Icon\r"]);

// "/Hygge/x" (estilo API, case-insensitive) → path absoluto DENTRO de LOCAL_ROOT
function toLocal(apiPath) {
  const rel = String(apiPath || "").replace(/^\/+/, "");
  const abs = nodePath.resolve(LOCAL_ROOT, rel);
  if (abs !== LOCAL_ROOT && !abs.startsWith(LOCAL_ROOT + nodePath.sep)) {
    throw new Error(`Path fuera del Dropbox local: ${apiPath}`);
  }
  return abs;
}

function toApi(absPath) {
  return "/" + nodePath.relative(LOCAL_ROOT, absPath).split(nodePath.sep).join("/");
}

async function statEntry(abs, name) {
  const st = await fs.stat(abs);
  const folder = st.isDirectory();
  return {
    name,
    path: toApi(abs),
    type: folder ? "folder" : "file",
    modified: st.mtime.toISOString(),
    ...(folder ? {} : { size: st.size }),
  };
}

// Si el destino existe, busca "nombre (1).ext", "nombre (2).ext"… (semántica autorename)
async function freeName(absPath) {
  if (!existsSync(absPath)) return absPath;
  const dir = nodePath.dirname(absPath);
  const ext = nodePath.extname(absPath);
  const base = nodePath.basename(absPath, ext);
  for (let i = 1; i < 100; i++) {
    const candidate = nodePath.join(dir, `${base} (${i})${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Sin nombre libre para ${absPath}`);
}

const localDropbox = {
  search: async ({ query, path = "", maxResults = 10 }) => {
    const q = String(query || "").toLowerCase();
    if (!q) return [];
    const results = [];
    const queue = [toLocal(path)];
    let visited = 0;
    while (queue.length && results.length < maxResults && visited < 20000) {
      const dir = queue.shift();
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (FS_IGNORE.has(e.name) || e.name.startsWith(".")) continue;
        visited++;
        const abs = nodePath.join(dir, e.name);
        if (e.name.toLowerCase().includes(q)) {
          try { results.push(await statEntry(abs, e.name)); } catch {}
          if (results.length >= maxResults) break;
        }
        if (e.isDirectory()) queue.push(abs);
      }
    }
    return results;
  },

  getFileContent: async (filePath) => {
    // Archivos online-only: macOS los materializa solo al leer (puede tardar la 1ª vez)
    return fs.readFile(toLocal(filePath), "utf8");
  },

  // Buffer binario (para .xlsx/.xls)
  getFileBuffer: async (filePath) => fs.readFile(toLocal(filePath)),

  listFolder: async (path = "") => {
    const dir = toLocal(path);
    const names = await fs.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of names) {
      if (FS_IGNORE.has(e.name) || e.name.startsWith(".")) continue;
      try { out.push(await statEntry(nodePath.join(dir, e.name), e.name)); } catch {}
    }
    return out;
  },

  createFolder: async (path) => {
    await fs.mkdir(toLocal(path), { recursive: true });
    return { metadata: { path_display: path } };
  },

  moveFile: async (fromPath, toPath) => {
    const dest = await freeName(toLocal(toPath));
    await fs.mkdir(nodePath.dirname(dest), { recursive: true });
    await fs.rename(toLocal(fromPath), dest);
    return { path_display: toApi(dest), name: nodePath.basename(dest) };
  },

  deleteFolder: async (path) => {
    const abs = toLocal(path);
    if (abs === LOCAL_ROOT) throw new Error("No se borra la raíz del Dropbox");
    await fs.rm(abs, { recursive: true });
    return { ok: true };
  },

  uploadFile: async (path, content, { mode = "overwrite", autorename = false } = {}) => {
    let abs = toLocal(path);
    if (mode !== "overwrite" && autorename) abs = await freeName(abs);
    else if (mode !== "overwrite" && existsSync(abs)) throw new Error(`Ya existe: ${path}`);
    await fs.mkdir(nodePath.dirname(abs), { recursive: true });
    await fs.writeFile(abs, Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"));
    const st = await fs.stat(abs);
    return { name: nodePath.basename(abs), path_display: toApi(abs), size: st.size };
  },
};

export const dropbox = LOCAL_MODE ? localDropbox : apiDropbox;

export const dropboxAvailable = () => LOCAL_MODE
  ? !!(LOCAL_ROOT && existsSync(LOCAL_ROOT))
  : !!(process.env.DROPBOX_ACCESS_TOKEN || (APP_KEY && APP_SECRET && getDropboxRefreshToken()));
