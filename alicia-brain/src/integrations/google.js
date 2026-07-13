// Google Calendar + Gmail · OAuth2
import dotenv from "dotenv";
dotenv.config();

import { query } from "../db.js";

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Tokens por usuario · app_settings key = google_refresh_token_<userId>
// Legacy: 'google_refresh_token' (sin sufijo) pertenece a sb. Env var también es de sb.
export function getRefreshToken(userId = "sb") {
  try {
    const { rows } = query("SELECT value FROM app_settings WHERE key = ?", [`google_refresh_token_${userId}`]);
    if (rows[0]?.value) return rows[0].value;
  } catch {}
  if (userId === "sb") {
    if (process.env.GOOGLE_REFRESH_TOKEN) return process.env.GOOGLE_REFRESH_TOKEN;
    try {
      const { rows } = query("SELECT value FROM app_settings WHERE key = 'google_refresh_token'");
      return rows[0]?.value || null;
    } catch {}
  }
  return null;
}

const _tokens = new Map(); // userId → { token, expiry }
export function clearTokenCache() { _tokens.clear(); }

async function getAccessToken(userId = "sb") {
  const cached = _tokens.get(userId);
  if (cached && Date.now() < cached.expiry - 60000) return cached.token;
  const refreshToken = getRefreshToken(userId);
  if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) {
    throw new Error(`Google no conectado para ${userId} — autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`);
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error (${userId}): ${data.error_description || data.error}`);
  _tokens.set(userId, { token: data.access_token, expiry: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

async function gFetch(url, options = {}, userId = "sb") {
  const token = await getAccessToken(userId);
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google API error ${res.status}: ${err.error?.message || JSON.stringify(err)}`);
  }
  return res.json();
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export const googleCalendar = {
  listEvents: async ({ timeMin, timeMax, maxResults = 20 } = {}, userId = "sb") => {
    const now = new Date();
    const params = new URLSearchParams({
      timeMin: timeMin || now.toISOString(),
      timeMax: timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });
    const data = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {}, userId);
    return (data.items || []).map(e => ({
      id:          e.id,
      title:       e.summary || "(sin título)",
      start:       e.start?.dateTime || e.start?.date,
      end:         e.end?.dateTime || e.end?.date,
      location:    e.location || null,
      description: e.description || null,
      attendees:   (e.attendees || []).map(a => a.email),
      meetLink:    e.hangoutLink || null,
    }));
  },

  createEvent: async ({ title, date, time, endTime, attendees = [], description, location }, userId = "sb") => {
    const start = time ? `${date}T${time}:00` : date;
    const end   = endTime ? `${date}T${endTime}:00` : (time ? `${date}T${time.replace(/(\d+):/, m => String(parseInt(m)+1)+':')}:00` : date);
    const body = {
      summary:     title,
      description: description || null,
      location:    location || null,
      start: time ? { dateTime: start, timeZone: "America/Lima" } : { date },
      end:   time ? { dateTime: end,   timeZone: "America/Lima" } : { date },
      attendees: attendees.map(email => ({ email })),
      conferenceData: { createRequest: { requestId: Date.now().toString() } },
    };
    return gFetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      { method: "POST", body: JSON.stringify(body) },
      userId
    );
  },
};

// Disponibilidad (free/busy) de una o varias personas — solo bloques ocupados, sin detalles.
// Funciona con el token del solicitante; si no está conectado, cae al de sb (Workspace permite
// consultar free/busy del dominio).
export async function freeBusy({ emails, timeMin, timeMax }, userId = "sb") {
  const body = JSON.stringify({ timeMin, timeMax, timeZone: "America/Lima", items: emails.map(id => ({ id })) });
  const doQuery = (uid) => gFetch("https://www.googleapis.com/calendar/v3/freeBusy", { method: "POST", body }, uid);
  try {
    return (await doQuery(getRefreshToken(userId) ? userId : "sb")).calendars || {};
  } catch (e) {
    if (userId !== "sb") return (await doQuery("sb")).calendars || {};
    throw e;
  }
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

export const gmail = {
  listThreads: async ({ query = "", maxResults = 10 } = {}, userId = "sb") => {
    const params = new URLSearchParams({ q: query, maxResults });
    const data = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`, {}, userId);
    return data.threads || [];
  },

  getThread: async (threadId, userId = "sb") => {
    const data = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {}, userId);
    return (data.messages || []).map(msg => {
      const headers = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
      const body = extractBody(msg.payload);
      return {
        id:      msg.id,
        from:    headers.from,
        to:      headers.to,
        subject: headers.subject,
        date:    headers.date,
        body:    body?.slice(0, 3000),
      };
    });
  },

  searchEmails: async ({ query, maxResults = 5 }, userId = "sb") => {
    const threads = await gmail.listThreads({ query, maxResults }, userId);
    const results = [];
    for (const t of threads.slice(0, 3)) {
      const msgs = await gmail.getThread(t.id, userId);
      if (msgs[0]) results.push(msgs[0]);
    }
    return results;
  },

  createDraft: async ({ to, subject, body }, userId = "sb") => {
    const raw = btoa(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`)
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return gFetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      body: JSON.stringify({ message: { raw } }),
    }, userId);
  },
};

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) return Buffer.from(payload.body.data, "base64").toString("utf8");
  if (payload.parts) {
    for (const p of payload.parts) {
      const text = extractBody(p);
      if (text) return text;
    }
  }
  return "";
}

export const googleAvailable = (userId = "sb") => !!(CLIENT_ID && CLIENT_SECRET && getRefreshToken(userId));
