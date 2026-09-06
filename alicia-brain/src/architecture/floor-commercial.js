const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function polygonArea(polygon = []) {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + number(point?.[0]) * number(next?.[1]) - number(next?.[0]) * number(point?.[1]);
  }, 0)) / 2;
}

export function evaluateFloorCommercialPerformance(proposal = {}, brief = {}) {
  const polygons = Array.isArray(proposal.floor?.polygons) ? proposal.floor.polygons : [];
  const sellableAreaPerFloor = polygons.filter((item) => item.role === "unidad")
    .reduce((sum, item) => sum + polygonArea(item.polygon), 0);
  const commonAreaPerFloor = polygons.filter((item) => item.role !== "unidad")
    .reduce((sum, item) => sum + polygonArea(item.polygon), 0);
  const grossAreaPerFloor = sellableAreaPerFloor + commonAreaPerFloor;
  const floors = Math.max(1, number(brief.floors, 1));
  const projectSellableArea = sellableAreaPerFloor * floors + number(brief.fixedSellableArea);
  const projectBuiltArea = grossAreaPerFloor * floors + number(brief.fixedBuiltArea);
  const projectedRevenue = projectSellableArea * number(brief.pricePerSellableM2) + number(brief.fixedRevenue);
  const projectedConstructionCost = projectBuiltArea * number(brief.costPerBuiltM2);
  const projectedSalesCost = projectedRevenue * number(brief.salesCostPct) / 100;
  const projectedProfitBeforeTax = projectedRevenue - projectedConstructionCost - projectedSalesCost - number(brief.landCost);
  const projectedIncomeTax = Math.max(0, projectedProfitBeforeTax) * number(brief.incomeTaxPct) / 100;
  const projectedNetProfit = projectedProfitBeforeTax - projectedIncomeTax;

  return {
    sellableAreaPerFloor: round(sellableAreaPerFloor),
    commonAreaPerFloor: round(commonAreaPerFloor),
    grossAreaPerFloor: round(grossAreaPerFloor),
    efficiencyPct: round(grossAreaPerFloor ? sellableAreaPerFloor / grossAreaPerFloor * 100 : 0),
    projectSellableArea: round(projectSellableArea),
    projectBuiltArea: round(projectBuiltArea),
    projectedRevenue: round(projectedRevenue),
    projectedConstructionCost: round(projectedConstructionCost),
    projectedSalesCost: round(projectedSalesCost),
    projectedProfitBeforeTax: round(projectedProfitBeforeTax),
    projectedIncomeTax: round(projectedIncomeTax),
    projectedNetProfit: round(projectedNetProfit),
    projectedNetMarginPct: round(projectedRevenue ? projectedNetProfit / projectedRevenue * 100 : 0),
  };
}

export function commercialBaselineFinding(evaluation, baseline, toleranceRatio = 0.005) {
  if (!evaluation || !baseline) return null;
  const tolerance = Math.max(0.05, baseline.sellableAreaPerFloor * toleranceRatio);
  if (evaluation.sellableAreaPerFloor + tolerance >= baseline.sellableAreaPerFloor) return null;
  const lostArea = baseline.sellableAreaPerFloor - evaluation.sellableAreaPerFloor;
  const lostProfit = baseline.projectedNetProfit - evaluation.projectedNetProfit;
  return {
    code: "commercial_underperformance",
    severity: "major",
    polygonIds: [],
    unitRefs: [],
    message: `La propuesta pierde ${lostArea.toFixed(2)} m² vendibles por piso y ${lostProfit.toFixed(0)} de utilidad proyectada frente al respaldo`,
  };
}
