import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFloorCommercialPerformance } from "../src/architecture/floor-commercial.js";

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

test("la evaluación económica usa el vendible dibujado y los valores de Cabida", () => {
  const proposal = {
    floor: {
      polygons: [
        { role: "unidad", polygon: rect(0, 0, 8, 10) },
        { role: "core", polygon: rect(8, 0, 9, 10) },
        { role: "circulacion", polygon: rect(9, 0, 10, 10) },
      ],
    },
  };

  const result = evaluateFloorCommercialPerformance(proposal, {
    floors: 2,
    fixedSellableArea: 20,
    fixedBuiltArea: 50,
    fixedRevenue: 20_000,
    pricePerSellableM2: 1_000,
    costPerBuiltM2: 500,
    salesCostPct: 10,
    landCost: 10_000,
    incomeTaxPct: 30,
  });

  assert.deepEqual(result, {
    sellableAreaPerFloor: 80,
    commonAreaPerFloor: 20,
    grossAreaPerFloor: 100,
    efficiencyPct: 80,
    projectSellableArea: 180,
    projectBuiltArea: 250,
    projectedRevenue: 200_000,
    projectedConstructionCost: 125_000,
    projectedSalesCost: 20_000,
    projectedProfitBeforeTax: 45_000,
    projectedIncomeTax: 13_500,
    projectedNetProfit: 31_500,
    projectedNetMarginPct: 15.75,
  });
});
