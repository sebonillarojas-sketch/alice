import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// GET /api/spaces — árbol completo
router.get("/", (req, res) => {
  const { rows } = query("SELECT * FROM spaces ORDER BY position, name");
  // Armar árbol
  const map = {};
  rows.forEach(s => { map[s.id] = { ...s, children: [] }; });
  const roots = [];
  rows.forEach(s => {
    if (s.parent_id && map[s.parent_id]) map[s.parent_id].children.push(map[s.id]);
    else roots.push(map[s.id]);
  });
  res.json(roots);
});

// GET /api/spaces/:id
router.get("/:id", (req, res) => {
  const { rows } = query("SELECT * FROM spaces WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(rows[0]);
});

export default router;
