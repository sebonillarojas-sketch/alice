// Dropbox · OAuth con refresh token (los access tokens de Dropbox vencen a las 4h)
import dotenv from "dotenv";
dotenv.config();
import { query } from "../db.js";

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

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

export const dropbox = {
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

export const dropboxAvailable = () => !!(process.env.DROPBOX_ACCESS_TOKEN || (APP_KEY && APP_SECRET && getDropboxRefreshToken()));
