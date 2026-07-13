// Zoom · Server-to-Server OAuth
import dotenv from "dotenv";
dotenv.config();

const ACCOUNT_ID    = process.env.ZOOM_ACCOUNT_ID;
const CLIENT_ID     = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

let _token = null;
let _expiry = 0;

async function getToken() {
  if (_token && Date.now() < _expiry - 60000) return _token;
  if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Zoom credentials no configuradas (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)");
  }
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Zoom OAuth error: ${data.reason || JSON.stringify(data)}`);
  _token = data.access_token;
  _expiry = Date.now() + data.expires_in * 1000;
  return _token;
}

async function zFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Zoom API error ${res.status}: ${err.message || JSON.stringify(err)}`);
  }
  return res.json();
}

export const zoom = {
  listRecordings: async ({ from, to } = {}) => {
    const now = new Date();
    const params = new URLSearchParams({
      from: from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      to:   to   || now.toISOString().split("T")[0],
    });
    const data = await zFetch(`/users/me/recordings?${params}`);
    return (data.meetings || []).map(m => ({
      id:           m.uuid,
      meetingId:    m.id,
      topic:        m.topic,
      startTime:    m.start_time,
      duration:     m.duration,
      recordingFiles: (m.recording_files || [])
        .filter(f => f.file_type === "TRANSCRIPT" || f.file_type === "MP4")
        .map(f => ({ type: f.file_type, url: f.download_url })),
    }));
  },

  getTranscript: async (downloadUrl) => {
    const token = await getToken();
    const res = await fetch(`${downloadUrl}?access_token=${token}`);
    if (!res.ok) throw new Error(`Zoom transcript download error ${res.status}`);
    return res.text();
  },
};

export const zoomAvailable = () => !!(ACCOUNT_ID && CLIENT_ID && CLIENT_SECRET);
