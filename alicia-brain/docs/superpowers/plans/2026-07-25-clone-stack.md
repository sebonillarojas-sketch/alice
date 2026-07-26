# Clon-stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a nightly, sanitized clone of the ALICE stack on alicia-mac so Bandersnatch/Jabberwocky can attack it without touching production.

**Architecture:** `alicia-brain` gets a `sanitize.js` (data-driven redaction rules) + `snapshot.js` (`VACUUM INTO` + sanitize) exposed at `GET /api/admin/db-snapshot` (x-agent-key). alicia-mac scripts pull the sanitized DB nightly and launch an isolated `alicia-brain` instance on `127.0.0.1:4001` with a fake `.env`.

**Tech Stack:** Node ESM, better-sqlite3 (existing driver), `node:test`, bash + launchd.

## Global Constraints

- Sanitization happens **at the source** (in the snapshot endpoint) — real creds/PII never leave prod.
- Snapshot endpoint auth: reuse `requireAgentKey` (same as `/api/agents/report`), header `x-agent-key`.
- Clone binds `127.0.0.1:4001` only, with **dummy** external keys (Twilio/Google/Anthropic/Groq) and send-flags OFF.
- Sanitizer is **data-driven** (`SANITIZE_RULES`) and defensive (unknown tables/columns are skipped, never crash).
- Node ESM (`import`), 2-space indent, match existing `alicia-brain/src` style.

---

### Task 1: `sanitize.js` — redaction rules + `sanitizeDb`

**Files:**
- Create: `alicia-brain/src/sanitize.js`
- Test: `alicia-brain/src/sanitize.test.js`

**Interfaces:**
- Produces: `SANITIZE_RULES` (object) and `sanitizeDb(db) → { appSettings, oauth, profiles, messages }` where `db` is a better-sqlite3 connection. Mutates the given DB in place; returns counts of redacted rows.

- [ ] **Step 1: Write the failing test**

```js
// sanitize.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { sanitizeDb } from "./sanitize.js";

function seed() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE oauth_tokens (user_id TEXT, token TEXT);
    CREATE TABLE profiles (user_id TEXT, phone TEXT, email TEXT);
    CREATE TABLE messages (id INTEGER, content TEXT);
  `);
  db.prepare("INSERT INTO app_settings VALUES (?,?)").run("google_token", "ya29.SECRET");
  db.prepare("INSERT INTO app_settings VALUES (?,?)").run("ui_theme", "dark");
  db.prepare("INSERT INTO oauth_tokens VALUES (?,?)").run("sb", "real-refresh-token");
  db.prepare("INSERT INTO profiles VALUES (?,?,?)").run("sb", "+51999888777", "sebastian@hygge.pe");
  db.prepare("INSERT INTO messages VALUES (?,?)").run(1, "info sensible del negocio");
  return db;
}

test("borra secrets de app_settings pero deja lo no-sensible", () => {
  const db = seed();
  sanitizeDb(db);
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='google_token'").get().value, null);
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='ui_theme'").get().value, "dark");
});
test("vacía oauth_tokens y redacta profiles + messages", () => {
  const db = seed();
  const r = sanitizeDb(db);
  assert.equal(db.prepare("SELECT count(*) c FROM oauth_tokens").get().c, 0);
  assert.equal(db.prepare("SELECT phone FROM profiles WHERE user_id='sb'").get().phone, "+000000000");
  assert.notEqual(db.prepare("SELECT email FROM profiles WHERE user_id='sb'").get().email, "sebastian@hygge.pe");
  assert.equal(db.prepare("SELECT content FROM messages WHERE id=1").get().content, "[redactado]");
  assert.ok(r.appSettings >= 1);
});
test("no explota si falta una tabla/columna", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE app_settings (key TEXT, value TEXT);");
  assert.doesNotThrow(() => sanitizeDb(db));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd alicia-brain && node --test src/sanitize.test.js`
Expected: FAIL — `Cannot find module './sanitize.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// sanitize.js
export const SANITIZE_RULES = {
  appSettingsSecretKeyLike: ["%token%", "%key%", "%secret%", "dropbox%", "google%", "twilio%", "anthropic%", "groq%", "%password%"],
  dropTables: ["oauth_tokens"],
  profilePlaceholders: { phone: "+000000000", email: "qa@example.com" },
  redactContentTables: ["messages", "conversations"],
};

function safeRun(db, sql, ...args) {
  try { return db.prepare(sql).run(...args).changes; } catch { return 0; }
}

export function sanitizeDb(db) {
  const r = { appSettings: 0, oauth: 0, profiles: 0, messages: 0 };
  for (const pat of SANITIZE_RULES.appSettingsSecretKeyLike) {
    r.appSettings += safeRun(db, "UPDATE app_settings SET value=NULL WHERE lower(key) LIKE ?", pat.toLowerCase());
  }
  for (const t of SANITIZE_RULES.dropTables) r.oauth += safeRun(db, `DELETE FROM ${t}`);
  r.profiles += safeRun(db, "UPDATE profiles SET phone=?, email=?",
    SANITIZE_RULES.profilePlaceholders.phone, SANITIZE_RULES.profilePlaceholders.email);
  for (const t of SANITIZE_RULES.redactContentTables) r.messages += safeRun(db, `UPDATE ${t} SET content='[redactado]'`);
  return r;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/sanitize.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify real column names**

Run: `grep -nE "CREATE TABLE (app_settings|profiles|messages|conversations|oauth_tokens)" src/db.js`
Confirm the columns used above (`value`, `phone`, `email`, `content`) exist; if a table uses a different content column, add it to `redactContentTables` handling. (Defensive `safeRun` means a mismatch degrades to a no-op, but we want real redaction.)

- [ ] **Step 6: Commit**

```bash
git add src/sanitize.js src/sanitize.test.js
git commit -m "feat(clone): sanitize.js — reglas de redacción + sanitizeDb"
```

---

### Task 2: `snapshot.js` — `VACUUM INTO` + sanitize

**Files:**
- Create: `alicia-brain/src/snapshot.js`

**Interfaces:**
- Consumes: `sanitizeDb` from `sanitize.js`; the DB path from `db.js` (env `SQLITE_PATH` or its default).
- Produces: `async makeSnapshot() → string` (path to a sanitized temp `.db`). Caller must delete it after streaming.

- [ ] **Step 1: Write the module**

```js
// snapshot.js
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sanitizeDb } from "./sanitize.js";

const DB_PATH = process.env.SQLITE_PATH || "/data/alicia.db";

export async function makeSnapshot() {
  const out = join(tmpdir(), `alice-snapshot-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
  const src = new Database(DB_PATH, { readonly: true });
  try { src.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`); } finally { src.close(); }
  const copy = new Database(out);
  try { sanitizeDb(copy); copy.exec("VACUUM"); } finally { copy.close(); }
  return out;
}
```

- [ ] **Step 2: Smoke test manually**

Run: `SQLITE_PATH=./data/alicia.db node -e "import('./src/snapshot.js').then(async m=>{const p=await m.makeSnapshot();console.log('snapshot',p);})"`
Expected: prints a temp path; `sqlite3 <path> "pragma integrity_check"` → `ok`; `sqlite3 <path> "SELECT value FROM app_settings WHERE key LIKE '%token%'"` → no real token.

- [ ] **Step 3: Commit**

```bash
git add src/snapshot.js && git commit -m "feat(clone): snapshot.js — VACUUM INTO + sanitize"
```

---

### Task 3: `/api/admin/db-snapshot` endpoint

**Files:**
- Modify: `alicia-brain/src/server.js` (add route near the other `/api/agents/*` routes, ~line 1496)

**Interfaces:**
- Consumes: `makeSnapshot` from `snapshot.js`, existing `requireAgentKey` middleware.

- [ ] **Step 1: Add the route**

```js
// server.js — junto a los otros /api/agents/*
import { makeSnapshot } from "./snapshot.js";
import { unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";

app.get("/api/admin/db-snapshot", requireAgentKey, async (req, res) => {
  let path;
  try {
    path = await makeSnapshot();
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="alice-clone.db"');
    const stream = createReadStream(path);
    stream.pipe(res);
    stream.on("close", () => unlink(path).catch(() => {}));
    stream.on("error", () => { res.destroy(); unlink(path).catch(() => {}); });
  } catch (e) {
    if (path) unlink(path).catch(() => {});
    res.status(500).json({ error: "snapshot falló", detail: String(e.message) });
  }
});
```

- [ ] **Step 2: Verify locally**

Run: start the server locally, then `curl -s -H "x-agent-key: $AGENTS_API_KEY" http://localhost:PORT/api/admin/db-snapshot -o /tmp/clone.db && sqlite3 /tmp/clone.db "pragma integrity_check"`
Expected: `ok`, and the file is a valid sanitized SQLite DB.

- [ ] **Step 3: Commit**

```bash
git add src/server.js && git commit -m "feat(clone): endpoint /api/admin/db-snapshot (auth x-agent-key)"
```

---

### Task 4: alicia-mac clone builder + launchd

**Files:**
- Create: `~/wonderland/clone/rebuild.sh`
- Create: `~/wonderland/clone/.env.clone.example`
- Create: `~/wonderland/clone/launch.sh`
- Create: `~/wonderland/clone/com.hygge.clone.plist`
- Create: `~/wonderland/clone/README.md`

**Interfaces:** shell scripts; consume the snapshot endpoint from Task 3.

- [ ] **Step 1: Write `rebuild.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${AGENTS_API_KEY:?falta AGENTS_API_KEY}"
BACKEND="${BACKEND:-https://aliceai.bam.pe}"
mkdir -p data-clone
TMP="data-clone/alicia.db.tmp"
echo "🪞 bajando snapshot sanitizado…"
curl -fsS -H "x-agent-key: $AGENTS_API_KEY" "$BACKEND/api/admin/db-snapshot" -o "$TMP"
if [ "$(sqlite3 "$TMP" 'pragma integrity_check' 2>/dev/null)" != "ok" ]; then
  echo "❌ snapshot corrupto — NO relanzo el clon"; exit 1
fi
mv "$TMP" data-clone/alicia.db
echo "✔ clon actualizado. relanzando :4001…"
./launch.sh
```

- [ ] **Step 2: Write `.env.clone.example` + `launch.sh`**

```
# .env.clone.example — TODO valor externo es DUMMY a propósito
PORT=4001
HOST=127.0.0.1
SQLITE_PATH=./data-clone/alicia.db
WA_ENABLED=false
TWILIO_ACCOUNT_SID=CLONE-DUMMY
TWILIO_AUTH_TOKEN=CLONE-DUMMY
GOOGLE_CLIENT_ID=CLONE-DUMMY
GOOGLE_CLIENT_SECRET=CLONE-DUMMY
ANTHROPIC_API_KEY=CLONE-DUMMY
GROQ_API_KEY=CLONE-DUMMY
```

```bash
#!/usr/bin/env bash
# launch.sh — levanta la instancia clon aislada
set -euo pipefail
cd "$(dirname "$0")"
BRAIN="${BRAIN:-$HOME/alice/alicia-brain}"   # copia local del código
[ -f .env.clone ] || { echo "falta .env.clone (copiá de .env.clone.example)"; exit 1; }
[ -f clone.pid ] && kill "$(cat clone.pid)" 2>/dev/null || true
set -a; . ./.env.clone; set +a
SQLITE_PATH="$(pwd)/data-clone/alicia.db" node "$BRAIN/src/server.js" > clone.log 2>&1 &
echo $! > clone.pid
echo "clon en http://127.0.0.1:$PORT (pid $(cat clone.pid))"
```

- [ ] **Step 3: Write launchd plist (nightly 1am) + README**

```xml
<!-- com.hygge.clone.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.hygge.clone</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>/Users/sebastianbonilla/wonderland/clone/rebuild.sh</string></array>
  <key>WorkingDirectory</key><string>/Users/sebastianbonilla/wonderland/clone</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>1</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/sebastianbonilla/wonderland/clone/rebuild.log</string>
  <key>StandardErrorPath</key><string>/Users/sebastianbonilla/wonderland/clone/rebuild.err.log</string>
</dict></plist>
```

README: `chmod +x *.sh`, copy `.env.clone.example`→`.env.clone`, set `AGENTS_API_KEY`, ensure `sqlite3` CLI + a local `alicia-brain` checkout, `./rebuild.sh` once to test, then load the plist.

- [ ] **Step 4: Dry test (once)**

Run: `AGENTS_API_KEY=… ./rebuild.sh` then `curl -s http://127.0.0.1:4001/health`
Expected: rebuild prints "clon actualizado"; health returns 200.

- [ ] **Step 5: Commit + load schedule**

```bash
cd ~/wonderland/clone && git init -q; git add -A && git commit -m "feat(clone): builder alicia-mac (rebuild/launch/env/launchd)"
cp com.hygge.clone.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.hygge.clone.plist
```

## Self-Review

- **Spec coverage:** snapshot endpoint + sanitize-at-source (Tasks 1-3) ✓ · VACUUM INTO consistency (Task 2) ✓ · isolated clone :4001 + dummy env + localhost bind (Task 4) ✓ · nightly rebuild + integrity gate (Task 4) ✓ · findings-to-real-backend is the agents' job (out of scope) ✓ · Bandersnatch/Jabberwocky explicitly separate ✓.
- **Placeholders:** none — real code/commands throughout. (Column-name verification is an explicit step, not a placeholder.)
- **Type consistency:** `sanitizeDb(db)→counts`, `makeSnapshot()→path` consistent across Tasks 1-3.
