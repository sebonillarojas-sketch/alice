const cloneObject = (value) => value && typeof value === "object" && !Array.isArray(value)
  ? structuredClone(value)
  : {};

const cloneArray = (value) => Array.isArray(value) ? structuredClone(value) : [];

export function normalizeProjectContext(input = {}) {
  const project = input.project && typeof input.project === "object" ? input.project : {};
  return {
    project: {
      id: String(project.id || "").trim(),
      name: String(project.name || "").trim(),
    },
    brief: cloneObject(input.brief),
    site: cloneObject(input.site),
    constraints: cloneObject(input.constraints),
    lockedElements: cloneArray(input.lockedElements),
    assumptions: cloneArray(input.assumptions),
    sourcePlanVersionId: input.sourcePlanVersionId == null ? null : String(input.sourcePlanVersionId),
    verifiedEvidence: cloneArray(input.verifiedEvidence)
      .filter((e) => e && typeof e === "object" && e.id)
      .map((e) => ({
        id: String(e.id),
        title: String(e.title || e.id),
        source: String(e.source || ""),
        excerpt: String(e.excerpt || "").slice(0, 4000),
        verified: e.verified === true,
      })),
  };
}
