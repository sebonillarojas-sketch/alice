import { DESIGN_OUTPUT_SCHEMA, CRITIQUE_OUTPUT_SCHEMA } from "./schemas.js";
import { TWEEDLEDUM_PROMPT_VERSION } from "./prompts/tweedledum.v1.js";
import { TWEEDLEDEE_PROMPT_VERSION } from "./prompts/tweedledee.v1.js";
import { TWEEDLEDUM_FLOOR_PROMPT_VERSION } from "./prompts/tweedledum-floor.v1.js";

export const ARCHITECTURE_AGENT_REGISTRY = Object.freeze({
  tweedledum: Object.freeze({
    key: "tweedledum",
    displayName: "Tweedledum",
    role: "architecture_designer",
    promptVersion: TWEEDLEDUM_PROMPT_VERSION,
    floorPromptVersion: TWEEDLEDUM_FLOOR_PROMPT_VERSION,
    model: "claude-sonnet-4-6",
    availableTools: ["get_project_context", "get_plan_version", "list_accepted_findings"],
    outputSchema: DESIGN_OUTPUT_SCHEMA,
  }),
  tweedledee: Object.freeze({
    key: "tweedledee",
    displayName: "Tweedledee",
    role: "architecture_critic",
    promptVersion: TWEEDLEDEE_PROMPT_VERSION,
    model: "claude-sonnet-4-6",
    availableTools: ["get_project_context", "get_plan_version", "get_deterministic_validation", "list_verified_evidence"],
    outputSchema: CRITIQUE_OUTPUT_SCHEMA,
  }),
});

export function publicAgentRegistry() {
  return Object.values(ARCHITECTURE_AGENT_REGISTRY).map((agent) => structuredClone(agent));
}
