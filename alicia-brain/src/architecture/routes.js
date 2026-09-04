import express from "express";
import { publicAgentRegistry } from "./registry.js";
import { ArchitectureValidationError } from "./schemas.js";
import { ArchitectureModelError, createArchitectureService } from "./service.js";
import { runArchitectureReviewCycle } from "./workflow.js";

function sendError(res, error) {
  if (error instanceof ArchitectureValidationError) {
    return res.status(400).json({ error: error.message, code: error.code, details: error.details });
  }
  if (error instanceof ArchitectureModelError) {
    const unavailable = /API_KEY|not configured|unavailable/i.test(error.message);
    return res.status(unavailable ? 503 : 502).json({ error: error.message, code: error.code });
  }
  console.error("architecture route:", error);
  return res.status(500).json({ error: "Architecture service failed", code: "ARCHITECTURE_INTERNAL_ERROR" });
}

const handler = (fn) => async (req, res) => {
  try { res.json(await fn(req.body || {})); }
  catch (error) { sendError(res, error); }
};

export function createArchitectureRouter({ service = createArchitectureService() } = {}) {
  const router = express.Router();
  router.get("/agents", (_req, res) => res.json({ agents: publicAgentRegistry() }));
  router.post("/tweedledum/floor-plan", handler((body) => service.planFloor(body)));
  router.post("/tweedledum/design", handler((body) => service.design(body)));
  router.post("/tweedledum/revise", handler((body) => service.revise(body)));
  router.post("/tweedledee/critique", handler((body) => service.critique(body)));
  router.post("/review-cycle", handler((body) => runArchitectureReviewCycle(body, { service })));
  return router;
}
