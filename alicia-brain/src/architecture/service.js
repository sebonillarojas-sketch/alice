import Anthropic from "@anthropic-ai/sdk";
import { normalizeProjectContext } from "./context.js";
import {
  ArchitectureValidationError,
  normalizeCritiqueOutput,
  normalizeDesignOutput,
  validateCritiqueRequest,
  validateDesignRequest,
} from "./schemas.js";
import { ARCHITECTURE_AGENT_REGISTRY } from "./registry.js";
import { loadAdvisoryReferences } from "./knowledge.js";
import { buildTweedledumSystemPrompt } from "./prompts/tweedledum.v1.js";
import { buildTweedledeeSystemPrompt } from "./prompts/tweedledee.v1.js";

export class ArchitectureModelError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "ArchitectureModelError";
    this.code = "ARCHITECTURE_MODEL_ERROR";
    this.cause = cause;
  }
}

function extractJson(text) {
  let raw = String(text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ArchitectureModelError("Architecture agent returned no JSON object");
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch (error) { throw new ArchitectureModelError("Architecture agent returned invalid JSON", error); }
}

function responseText(response) {
  return response?.content?.find((block) => block.type === "text")?.text || "";
}

const requestPayload = (value) => JSON.stringify(value, null, 2);

export function createArchitectureService({ client = null, model = null } = {}) {
  let resolvedClient = client;
  const getClient = () => {
    if (resolvedClient) return resolvedClient;
    if (!process.env.ANTHROPIC_API_KEY) throw new ArchitectureModelError("ANTHROPIC_API_KEY is not configured");
    resolvedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return resolvedClient;
  };

  const call = async (agentKey, system, payload, normalize) => {
    const agent = ARCHITECTURE_AGENT_REGISTRY[agentKey];
    let response;
    try {
      response = await getClient().messages.create({
        model: model || agent.model,
        max_tokens: agentKey === "tweedledum" ? 16000 : 8000,
        system,
        messages: [{ role: "user", content: requestPayload(payload) }],
      });
    } catch (error) {
      if (error instanceof ArchitectureValidationError || error instanceof ArchitectureModelError) throw error;
      throw new ArchitectureModelError(`${agent.displayName} request failed: ${error.message}`, error);
    }
    let output;
    try { output = normalize(extractJson(responseText(response))); }
    catch (error) {
      if (error instanceof ArchitectureModelError) throw error;
      throw new ArchitectureModelError(`${agent.displayName} returned an invalid structured response: ${error.message}`, error);
    }
    return { ...output, agent: { key: agent.key, displayName: agent.displayName }, promptVersion: agent.promptVersion, model: model || agent.model };
  };

  return {
    async design(input = {}) {
      const context = normalizeProjectContext(input.context);
      const request = { ...input, context };
      validateDesignRequest(request);
      return call("tweedledum", buildTweedledumSystemPrompt(loadAdvisoryReferences("tweedledum")), {
        operation: "design",
        context,
        brief: input.brief || {},
        planVersion: input.planVersion || null,
        designObjective: String(input.designObjective || "balanced architecture"),
      }, normalizeDesignOutput);
    },

    async revise(input = {}) {
      const context = normalizeProjectContext(input.context);
      const request = { ...input, context, brief: input.brief || {}, planVersion: input.planVersion };
      validateDesignRequest(request);
      return call("tweedledum", buildTweedledumSystemPrompt(loadAdvisoryReferences("tweedledum")), {
        operation: "revise",
        context,
        brief: input.brief || {},
        planVersion: input.planVersion,
        acceptedFindings: Array.isArray(input.acceptedFindings) ? input.acceptedFindings : [],
        designObjective: String(input.designObjective || "resolve accepted findings"),
      }, normalizeDesignOutput);
    },

    async critique(input = {}) {
      const context = normalizeProjectContext(input.context);
      const request = { ...input, context };
      validateCritiqueRequest(request);
      return call("tweedledee", buildTweedledeeSystemPrompt(loadAdvisoryReferences("tweedledee")), {
        operation: "critique",
        context,
        planVersion: input.planVersion,
        deterministicValidation: input.deterministicValidation,
        designObjective: String(input.designObjective || "balanced architecture"),
      }, (output) => normalizeCritiqueOutput(output, context));
    },
  };
}
