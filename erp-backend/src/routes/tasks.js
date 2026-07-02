import { Router } from "express";
import { query, parseArr } from "../db.js";

const router = Router();

function parseTask(t) {
  t.tags = parseArr(t.tags);
  return t;
}

// GET /api/tasks — listar con filtros opcionales
router.get("/", (req, res) => {
  const { space_id, assignee_id, status, parent_id } = req.query;
  const wheres = [];
  const params = [];

  if (space_id)    { wheres.push("space_id = ?");    params.push(space_id); }
  if (assignee_id) { wheres.push("assignee_id = ?"); params.push(assignee_id); }
  if (status)      { wheres.push("status = ?");       params.push(status); }
  if (parent_id !== undefined) {
    wheres.push(parent_id === "null" ? "parent_id IS NULL" : "parent_id = ?");
    if (parent_id !== "null") params.push(Number(parent_id));
  }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const { rows } = query(`SELECT * FROM tasks ${where} ORDER BY position, created_at DESC`, params);
  res.json(rows.map(parseTask));
});

// GET /api/tasks/:id
router.get("/:id", (req, res) => {
  const { rows } = query("SELECT * FROM tasks WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });

  const task = parseTask(rows[0]);
  const { rows: comments } = query("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at", [task.id]);
  const { rows: activity } = query("SELECT * FROM task_activity WHERE task_id = ? ORDER BY created_at DESC LIMIT 50", [task.id]);
  res.json({ ...task, comments, activity });
});

// POST /api/tasks — crear tarea
router.post("/", (req, res) => {
  const { title, description, space_id, parent_id, status, priority, assignee_id, due_date, tags, created_by } = req.body;
  if (!title || !space_id) return res.status(400).json({ error: "title y space_id son obligatorios" });

  const { lastID } = query(
    `INSERT INTO tasks (title, description, space_id, parent_id, status, priority, assignee_id, due_date, tags, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), description || null, space_id, parent_id || null,
     status || "todo", priority || "media", assignee_id || null,
     due_date || null, JSON.stringify(tags || []), created_by || null]
  );

  logActivity(lastID, created_by, "created", null, title.trim());

  const { rows } = query("SELECT * FROM tasks WHERE id = ?", [lastID]);
  res.status(201).json(parseTask(rows[0]));
});

// PATCH /api/tasks/:id — actualizar campos
router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { rows: existing } = query("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!existing[0]) return res.status(404).json({ error: "No encontrado" });

  const task = existing[0];
  const allowed = ["title", "description", "status", "priority", "assignee_id", "due_date", "tags", "parent_id", "space_id", "position"];
  const updates = [];
  const params = [];
  const { updated_by, ...body } = req.body;

  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`);
      params.push(key === "tags" ? JSON.stringify(body[key]) : body[key]);

      // Registrar cambios relevantes en activity
      if (["status", "priority", "assignee_id"].includes(key) && task[key] !== body[key]) {
        logActivity(id, updated_by, `updated_${key}`, task[key], body[key]);
      }
    }
  }

  if (!updates.length) return res.status(400).json({ error: "Nada que actualizar" });

  updates.push("updated_at = datetime('now')");
  params.push(id);
  query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`, params);

  const { rows } = query("SELECT * FROM tasks WHERE id = ?", [id]);
  res.json(parseTask(rows[0]));
});

// DELETE /api/tasks/:id
router.delete("/:id", (req, res) => {
  const { changes } = query("DELETE FROM tasks WHERE id = ?", [req.params.id]);
  if (!changes) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

// POST /api/tasks/:id/comments
router.post("/:id/comments", (req, res) => {
  const { user_id, content } = req.body;
  if (!content) return res.status(400).json({ error: "content es obligatorio" });
  const { lastID } = query(
    "INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)",
    [req.params.id, user_id || null, content]
  );
  const { rows } = query("SELECT * FROM task_comments WHERE id = ?", [lastID]);
  res.status(201).json(rows[0]);
});

function logActivity(taskId, userId, action, fromVal, toVal) {
  try {
    query(
      "INSERT INTO task_activity (task_id, user_id, action, from_val, to_val) VALUES (?, ?, ?, ?, ?)",
      [taskId, userId || null, action, fromVal || null, toVal || null]
    );
  } catch {}
}

export default router;
