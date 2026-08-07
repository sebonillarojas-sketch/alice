// src/fleet-routes.js — endpoints del protocolo de la flota, como Router aislado
// (se monta en /api/agents/workers, así pasa el panelGate que abre x-agent-key en
// rutas /agents/*). Aislado a propósito: testeable sin bootear todo server.js.
import { Router } from "express";
import * as fleet from "./fleet.js";
import { saveSnapshot } from "./market.js";

function agentKey(req, res, next) {
  const key = req.headers["x-agent-key"] || "";
  if (!process.env.AGENTS_API_KEY || key !== process.env.AGENTS_API_KEY) {
    return res.status(401).json({ error: "x-agent-key inválida" });
  }
  next();
}

export function fleetRouter() {
  const r = Router();

  // El worker anuncia que está vivo.
  r.post("/heartbeat", agentKey, (req, res) => {
    const { workerId, node, caps } = req.body || {};
    if (!workerId) return res.status(400).json({ error: "workerId requerido" });
    res.json(fleet.recordHeartbeat({ workerId, node, caps: Array.isArray(caps) ? caps : [] }));
  });

  // El worker jala el próximo job pendiente (o null).
  r.get("/next", agentKey, (req, res) => {
    const { workerId } = req.query;
    if (!workerId) return res.status(400).json({ error: "workerId requerido" });
    res.json({ job: fleet.claimJob(String(workerId)) });
  });

  // El worker devuelve el resultado; si trae filas, se guardan en market_snapshots.
  r.post("/result", agentKey, (req, res) => {
    const { jobId, workerId, source, rows, error } = req.body || {};
    if (!jobId || !workerId) return res.status(400).json({ error: "jobId y workerId requeridos" });
    if (Array.isArray(rows) && rows.length && source) saveSnapshot(rows, source);
    res.json(fleet.completeJob({
      jobId, workerId,
      rowsCount: Array.isArray(rows) ? rows.length : 0,
      error: error || null,
    }));
  });

  return r;
}
