import { validateArchitectureLayout } from "./validation.js";

const actionable = (findings = []) => findings.filter((finding) => ["critical", "major"].includes(finding.severity));

export async function runArchitectureReviewCycle(input = {}, { service } = {}) {
  if (!service?.design || !service?.critique || !service?.revise) throw new Error("Architecture service is required");
  const errors = [];
  const design = await service.design({
    ...(input.designRequest || {}),
    context: input.context,
  });
  const proposalId = input.proposalVersionId || `plan_${input.context?.project?.id || "project"}_cycle_proposal`;
  const critiqueContext = { ...input.context, sourcePlanVersionId: proposalId };
  const contractValidation = validateArchitectureLayout(design.layout, { planVersionId: proposalId });
  const suppliedValidation = input.deterministicValidation?.planVersionId === proposalId ? input.deterministicValidation : null;
  const deterministicValidation = suppliedValidation ? {
    ...contractValidation,
    ok: contractValidation.ok && suppliedValidation.ok === true,
    findings: [...contractValidation.findings, ...(Array.isArray(suppliedValidation.findings) ? suppliedValidation.findings : [])],
    clientValidation: suppliedValidation,
  } : contractValidation;
  const critique = await service.critique({
    context: critiqueContext,
    planVersion: { id: proposalId, layout: design.layout },
    deterministicValidation,
    designObjective: input.designRequest?.designObjective,
  });
  const acceptedFindings = actionable(critique.findings);
  let revision = null;
  if (acceptedFindings.length) {
    try {
      revision = await service.revise({
        context: critiqueContext,
        planVersion: { id: proposalId, layout: design.layout },
        brief: input.designRequest?.brief || {},
        designObjective: input.designRequest?.designObjective,
        acceptedFindings,
      });
    } catch (error) {
      errors.push({ stage: "revision", code: error.code || "REVISION_FAILED", message: error.message });
    }
  }
  return {
    design,
    proposalVersionId: proposalId,
    deterministicValidation,
    critique,
    revision,
    revisionPerformed: Boolean(revision),
    errors,
  };
}
