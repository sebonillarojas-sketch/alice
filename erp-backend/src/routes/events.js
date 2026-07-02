import { Router } from "express";
import { query, parseArr } from "../db.js";

const router = Router();

function parseEvent(e) {
  e.attendees = parseArr(e.attendees);
  return e;
}

// GET /api/events — listar, filtrar por rango de fechas o space
router.get("/", (req, res) => {
  const { from, to, space_id } = req.query;
  const wheres = [];
  const params = [];

  if (from)     { wheres.push("date >= ?"); params.push(from); }
  if (to)       { wheres.push("date <= ?"); params.push(to); }
  if (space_id) { wheres.push("space_id = ?"); params.push(space_id); }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const { rows } = query(`SELECT * FROM events ${where} ORDER BY date, time`, params);
  res.json(rows.map(parseEvent));
});

// GET /api/events/:id
router.get("/:id", (req, res) => {
  const { rows } = query("SELECT * FROM events WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(parseEvent(rows[0]));
});

// POST /api/events — crear evento
router.post("/", (req, res) => {
  const { title, description, date, time, end_time, attendees, space_id, purpose, brief, created_by } = req.body;
  if (!title || !date) return res.status(400).json({ error: "title y date son obligatorios" });

  const { lastID } = query(
    `INSERT INTO events (title, description, date, time, end_time, attendees, space_id, purpose, brief, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, date, time || null, end_time || null,
     JSON.stringify(attendees || []), space_id || null, purpose || null, brief || null, created_by || null]
  );

  const { rows } = query("SELECT * FROM events WHERE id = ?", [lastID]);
  res.status(201).json(parseEvent(rows[0]));
});

// PATCH /api/events/:id
router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { rows: existing } = query("SELECT * FROM events WHERE id = ?", [id]);
  if (!existing[0]) return res.status(404).json({ error: "No encontrado" });

  const allowed = ["title", "description", "date", "time", "end_time", "attendees", "space_id", "purpose", "brief"];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      params.push(key === "attendees" ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }

  if (!updates.length) return res.status(400).json({ error: "Nada que actualizar" });
  updates.push("updated_at = datetime('now')");
  params.push(id);
  query(`UPDATE events SET ${updates.join(", ")} WHERE id = ?`, params);

  const { rows } = query("SELECT * FROM events WHERE id = ?", [id]);
  res.json(parseEvent(rows[0]));
});

// DELETE /api/events/:id
router.delete("/:id", (req, res) => {
  const { changes } = query("DELETE FROM events WHERE id = ?", [req.params.id]);
  if (!changes) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

export default router;
