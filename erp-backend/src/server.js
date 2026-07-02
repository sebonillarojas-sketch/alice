import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tasksRouter  from "./routes/tasks.js";
import eventsRouter from "./routes/events.js";
import spacesRouter from "./routes/spaces.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Auth por API key ──────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY || "alice-erp-dev-key";

function authMiddleware(req, res, next) {
  // Health check sin auth
  if (req.path === "/health") return next();

  const key = req.headers["x-api-key"] || req.query.api_key;
  if (key !== API_KEY) return res.status(401).json({ error: "API key inválida" });
  next();
}

app.use(authMiddleware);

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use("/api/tasks",  tasksRouter);
app.use("/api/events", eventsRouter);
app.use("/api/spaces", spacesRouter);

app.get("/health", (_, res) => res.json({
  ok: true,
  service: "alice-erp-backend",
  version: "1.0.0",
  ts: new Date().toISOString(),
}));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`\n🟢 ALICE ERP Backend · http://localhost:${PORT}`);
  console.log(`   DB: ${process.env.SQLITE_PATH || "./alicia-erp.db"}`);
  console.log(`   POST /api/tasks  ·  GET /api/events  ·  GET /api/spaces\n`);
});
