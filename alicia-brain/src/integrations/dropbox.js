// Dropbox · access token
import dotenv from "dotenv";
dotenv.config();

const ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

async function dbxFetch(path, body) {
  if (!ACCESS_TOKEN) throw new Error("Dropbox no configurado (DROPBOX_ACCESS_TOKEN)");
  const res = await fetch(`https://api.dropboxapi.com/2${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Dropbox error ${res.status}: ${err.error_summary || JSON.stringify(err)}`);
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
    if (!ACCESS_TOKEN) throw new Error("Dropbox no configurado");
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
      },
    });
    if (!res.ok) throw new Error(`Dropbox download error ${res.status}`);
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
};

export const dropboxAvailable = () => !!ACCESS_TOKEN;
