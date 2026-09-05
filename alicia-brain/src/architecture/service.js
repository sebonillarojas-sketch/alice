import Anthropic from "@anthropic-ai/sdk";
import { isDeepStrictEqual } from "node:util";
import { normalizeProjectContext } from "./context.js";
import {
  ArchitectureValidationError,
  normalizeCritiqueOutput,
  normalizeDesignOutput,
  normalizeFloorPlanOutput,
  validateCritiqueRequest,
  validateDesignRequest,
  validateFloorPlanRequest,
  FLOOR_PLAN_OUTPUT_SCHEMA,
} from "./schemas.js";
import { ARCHITECTURE_AGENT_REGISTRY } from "./registry.js";
import { loadAdvisoryReferences } from "./knowledge.js";
import { buildTweedledumSystemPrompt } from "./prompts/tweedledum.v1.js";
import { buildTweedledeeSystemPrompt } from "./prompts/tweedledee.v1.js";
import { buildTweedledumFloorSystemPrompt, TWEEDLEDUM_FLOOR_PROMPT_VERSION } from "./prompts/tweedledum-floor.v1.js";
import { validateFloorProposal } from "./floor-validation.js";
import { commercialBaselineFinding, evaluateFloorCommercialPerformance } from "./floor-commercial.js";

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

function responsePayload(response, toolName) {
  const toolUse = response?.content?.find((block) => block.type === "tool_use" && block.name === toolName);
  if (toolUse?.input && typeof toolUse.input === "object") return toolUse.input;
  return extractJson(responseText(response));
}

const requestPayload = (value) => JSON.stringify(value);

const OUTPUT_TOKEN_BUDGET = Object.freeze({
  tweedledum: 6000,
  tweedledee: 2500,
});

export function createArchitectureService({ client = null, model = null } = {}) {
  let resolvedClient = client;
  const getClient = () => {
    if (resolvedClient) return resolvedClient;
    if (!process.env.ANTHROPIC_API_KEY) throw new ArchitectureModelError("ANTHROPIC_API_KEY is not configured");
    resolvedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return resolvedClient;
  };

  const call = async (agentKey, system, payload, normalize, options = {}) => {
    const agent = ARCHITECTURE_AGENT_REGISTRY[agentKey];
    const outputToolName = options.toolName || `submit_${agentKey}_output`;
    let response;
    try {
      response = await getClient().messages.create({
        model: model || agent.model,
        max_tokens: options.maxTokens || OUTPUT_TOKEN_BUDGET[agentKey],
        system,
        messages: [{ role: "user", content: requestPayload(payload) }],
        tools: [{
          name: outputToolName,
          description: `Submit the final structured ${agent.displayName} result.`,
          input_schema: options.outputSchema || agent.outputSchema,
        }],
        tool_choice: { type: "tool", name: outputToolName, disable_parallel_tool_use: true },
      });
    } catch (error) {
      if (error instanceof ArchitectureValidationError || error instanceof ArchitectureModelError) throw error;
      throw new ArchitectureModelError(`${agent.displayName} request failed: ${error.message}`, error);
    }
    let output;
    try { output = normalize(responsePayload(response, outputToolName)); }
    catch (error) {
      if (error instanceof ArchitectureModelError) throw error;
      throw new ArchitectureModelError(`${agent.displayName} returned an invalid structured response: ${error.message}`, error);
    }
    return { ...output, agent: { key: agent.key, displayName: agent.displayName }, promptVersion: options.promptVersion || agent.promptVersion, model: model || agent.model };
  };

  return {
    async planFloor(input = {}) {
      const context = normalizeProjectContext(input.context);
      const request = { ...input, context };
      validateFloorPlanRequest(request);
      const validationOptions = {
        buildableFootprint: context.site.buildableFootprint,
        sourceCabidaVersionId: context.sourceCabidaVersionId,
        unitsPerFloor: input.floorBrief.unitsPerFloor,
        mix: input.floorBrief.bedroomMix,
        targetAverageArea: input.floorBrief.targetAverageArea,
        targetAreaByBedrooms: input.floorBrief.targetAreaByBedrooms,
        areaTolerance: input.floorBrief.areaTolerance,
      };
      let fallback;
      try { fallback = normalizeFloorPlanOutput(input.deterministicFallback); }
      catch (error) { throw new ArchitectureModelError(`Deterministic fallback is invalid: ${error.message}`, error); }
      const fallbackValidation = validateFloorProposal(fallback, validationOptions);
      const commercialBrief = input.floorBrief.commercialBrief || {};
      const fallbackEvaluation = evaluateFloorCommercialPerformance(fallback, commercialBrief);
      const assess = (proposal) => {
        const validation = validateFloorProposal(proposal, { ...validationOptions, enforceIndividualUnitArea: true, requireExteriorFrontage: true });
        const evaluation = evaluateFloorCommercialPerformance(proposal, commercialBrief);
        const commercialFinding = fallbackValidation.ok ? commercialBaselineFinding(evaluation, fallbackEvaluation) : null;
        if (validation.ok && commercialFinding) {
          return { validation: { ...validation, ok: false, findings: [...validation.findings, commercialFinding] }, evaluation };
        }
        return { validation, evaluation };
      };
      const callFloor = (payload) => call(
        "tweedledum",
        buildTweedledumFloorSystemPrompt(loadAdvisoryReferences("tweedledum")),
        payload,
        normalizeFloorPlanOutput,
        {
          toolName: "submit_tweedledum_floor_output",
          outputSchema: FLOOR_PLAN_OUTPUT_SCHEMA,
          maxTokens: 3500,
          promptVersion: TWEEDLEDUM_FLOOR_PROMPT_VERSION,
        },
      );

      let originalProposal = null;
      let revision = null;
      let originalValidation = null;
      let revisionValidation = null;
      let originalEvaluation = null;
      let revisionEvaluation = null;
      let fallbackReason = null;
      try {
        originalProposal = await callFloor({ operation: "design_floor", context, floorBrief: input.floorBrief, deterministicBaseline: { validation: fallbackValidation, evaluation: fallbackEvaluation } });
        ({ validation: originalValidation, evaluation: originalEvaluation } = assess(originalProposal));
        if (originalValidation.ok) {
          return { originalProposal, revision, validation: originalValidation, evaluation: originalEvaluation, selected: originalProposal, source: "tweedledum", candidateValidation: { original: originalValidation, revision: null, fallback: fallbackValidation }, candidateEvaluation: { original: originalEvaluation, revision: null, fallback: fallbackEvaluation }, agent: originalProposal.agent, promptVersion: originalProposal.promptVersion, model: originalProposal.model };
        }
        revision = await callFloor({
          operation: "revise_floor",
          context,
          floorBrief: input.floorBrief,
          proposal: originalProposal.floor,
          deterministicFindings: originalValidation.findings,
          deterministicBaseline: { validation: fallbackValidation, evaluation: fallbackEvaluation },
        });
        ({ validation: revisionValidation, evaluation: revisionEvaluation } = assess(revision));
        if (revisionValidation.ok) {
          return { originalProposal, revision, validation: revisionValidation, evaluation: revisionEvaluation, selected: revision, source: "revision", candidateValidation: { original: originalValidation, revision: revisionValidation, fallback: fallbackValidation }, candidateEvaluation: { original: originalEvaluation, revision: revisionEvaluation, fallback: fallbackEvaluation }, agent: revision.agent, promptVersion: revision.promptVersion, model: revision.model };
        }
        fallbackReason = "Tweedledum revision did not pass deterministic validation";
      } catch (error) {
        fallbackReason = error.message || "Tweedledum floor planning failed";
      }

      if (!fallbackValidation.ok) {
        throw new ArchitectureModelError(`Deterministic fallback failed validation: ${fallbackValidation.findings.map((item) => item.message).join(" · ")}`);
      }
      const agent = ARCHITECTURE_AGENT_REGISTRY.tweedledum;
      return {
        originalProposal,
        revision,
        validation: fallbackValidation,
        evaluation: fallbackEvaluation,
        selected: fallback,
        source: "deterministic_fallback",
        fallbackReason,
        candidateValidation: { original: originalValidation, revision: revisionValidation, fallback: fallbackValidation },
        candidateEvaluation: { original: originalEvaluation, revision: revisionEvaluation, fallback: fallbackEvaluation },
        agent: { key: agent.key, displayName: agent.displayName },
        promptVersion: TWEEDLEDUM_FLOOR_PROMPT_VERSION,
        model: model || agent.model,
      };
    },

    async design(input = {}) {
      const context = normalizeProjectContext(input.context);
      const request = { ...input, context };
      validateDesignRequest(request);
      const output = await call("tweedledum", buildTweedledumSystemPrompt(loadAdvisoryReferences("tweedledum")), {
        operation: "design",
        context,
        brief: input.brief || {},
        planVersion: input.planVersion || null,
        designObjective: String(input.designObjective || "balanced architecture"),
      }, normalizeDesignOutput);
      if (input.planVersion?.layout && isDeepStrictEqual(output.layout, input.planVersion.layout)) {
        throw new ArchitectureModelError("Tweedledum did not produce new plan geometry");
      }
      return output;
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
