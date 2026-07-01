// Google Calendar + Gmail · OAuth2
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60000) return _accessToken;
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Google credentials no configuradas (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _accessToken;
}

async function gFetch(url, options = {}) {
  const token = await getAccessToken();
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
  listEvents: async ({ timeMin, timeMax, maxResults = 20 } = {}) => {
    const now = new Date();
    const params = new URLSearchParams({
      timeMin: timeMin || now.toISOString(),
      timeMax: timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });
    const data = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
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

  createEvent: async ({ title, date, time, endTime, attendees = [], description, location }) => {
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
      { method: "POST", body: JSON.stringify(body) }
    );
  },
};

// ── Gmail ─────────────────────────────────────────────────────────────────────

export const gmail = {
  listThreads: async ({ query = "", maxResults = 10 } = {}) => {
    const params = new URLSearchParams({ q: query, maxResults });
    const data = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`);
    return data.threads || [];
  },

  getThread: async (threadId) => {
    const data = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`);
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

  searchEmails: async ({ query, maxResults = 5 }) => {
    const threads = await gmail.listThreads({ query, maxResults });
    const results = [];
    for (const t of threads.slice(0, 3)) {
      const msgs = await gmail.getThread(t.id);
      if (msgs[0]) results.push(msgs[0]);
    }
    return results;
  },

  createDraft: async ({ to, subject, body }) => {
    const raw = btoa(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`)
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return gFetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      body: JSON.stringify({ message: { raw } }),
    });
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

export const googleAvailable = () => !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
