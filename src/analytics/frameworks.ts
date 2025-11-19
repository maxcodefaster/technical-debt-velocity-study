import { quantile } from "simple-statistics";
import { type ProcessedPeriod } from "./processing";
import { calculateMedian, removeOutliers } from "./math";

// ==================== INTERFACES ====================

export interface QuadrantMetrics {
  count: number;
  avgFundingGrowth: number;
  successRate: number;
  avgTDR: number;
  avgVelocity: number;
}

export interface TertileFramework {
  lowDebtLowVelocity: QuadrantMetrics;
  lowDebtMedVelocity: QuadrantMetrics;
  lowDebtHighVelocity: QuadrantMetrics;
  medDebtLowVelocity: QuadrantMetrics;
  medDebtMedVelocity: QuadrantMetrics;
  medDebtHighVelocity: QuadrantMetrics;
  highDebtLowVelocity: QuadrantMetrics;
  highDebtMedVelocity: QuadrantMetrics;
  highDebtHighVelocity: QuadrantMetrics;
}

export interface QuartileFramework {
  bottomLeft: QuadrantMetrics; // Low TDR (Q1), Low Velocity (Q1)
  bottomRight: QuadrantMetrics; // High TDR (Q4), Low Velocity (Q1)
  topLeft: QuadrantMetrics; // Low TDR (Q1), High Velocity (Q4)
  topRight: QuadrantMetrics; // High TDR (Q4), High Velocity (Q4)
}

export interface MarketCategoryAnalysis {
  category: string;
  count: number;
  avgTDR: number;
  avgVelocity: number;
  successRate: number;
}

// ==================== QUADRANT CALCULATIONS ====================

export function calculateQuadrantMetrics(
  data: ProcessedPeriod[]
): QuadrantMetrics {
  if (data.length === 0) {
    return {
      count: 0,
      avgFundingGrowth: 0,
      successRate: 0,
      avgTDR: 0,
      avgVelocity: 0,
    };
  }
  const fundingGrowthRates = data.map((d) => d.fundingGrowthRate);
  const cleanFundingGrowth = removeOutliers(fundingGrowthRates);

  return {
    count: data.length,
    avgFundingGrowth:
      cleanFundingGrowth.length > 0
        ? cleanFundingGrowth.reduce((sum, d) => sum + d, 0) /
          cleanFundingGrowth.length
        : 0,
    successRate:
      (data.filter((d) => d.gotNextRound).length / data.length) * 100,
    avgTDR: data.reduce((sum, d) => sum + d.endTDR, 0) / data.length,
    avgVelocity:
      data.reduce((sum, d) => sum + d.compositeVelocity, 0) / data.length,
  };
}

// ==================== STRATEGIC FRAMEWORK BUILDERS ====================

export function buildMedianQuadrantAnalysis(finalValidData: ProcessedPeriod[]) {
  const medianTDR = calculateMedian(finalValidData.map((d) => d.endTDR));
  const medianVelocity = calculateMedian(
    finalValidData.map((d) => d.compositeVelocity)
  );
  return {
    lowDebtHighVelocity: finalValidData.filter(
      (d) => d.endTDR <= medianTDR && d.compositeVelocity > medianVelocity
    ),
    highDebtHighVelocity: finalValidData.filter(
      (d) => d.endTDR > medianTDR && d.compositeVelocity > medianVelocity
    ),
    lowDebtLowVelocity: finalValidData.filter(
      (d) => d.endTDR <= medianTDR && d.compositeVelocity <= medianVelocity
    ),
    highDebtLowVelocity: finalValidData.filter(
      (d) => d.endTDR > medianTDR && d.compositeVelocity <= medianVelocity
    ),
  };
}

export function buildTertileFramework(
  finalValidData: ProcessedPeriod[]
): TertileFramework {
  const tdrValues = finalValidData.map((d) => d.endTDR);
  const velocityValues = finalValidData.map((d) => d.compositeVelocity);
  const tdrTertiles = [quantile(tdrValues, 1 / 3), quantile(tdrValues, 2 / 3)];
  const veloTertiles = [
    quantile(velocityValues, 1 / 3),
    quantile(velocityValues, 2 / 3),
  ];

  const getTDRCategory = (tdr: number) => {
    if (tdr <= tdrTertiles[0]!) return "low";
    if (tdr <= tdrTertiles[1]!) return "med";
    return "high";
  };

  const getVeloCategory = (velo: number) => {
    if (velo <= veloTertiles[0]!) return "low";
    if (velo <= veloTertiles[1]!) return "med";
    return "high";
  };

  const frameworkData = {
    lowDebtLowVelocity: [] as ProcessedPeriod[],
    lowDebtMedVelocity: [] as ProcessedPeriod[],
    lowDebtHighVelocity: [] as ProcessedPeriod[],
    medDebtLowVelocity: [] as ProcessedPeriod[],
    medDebtMedVelocity: [] as ProcessedPeriod[],
    medDebtHighVelocity: [] as ProcessedPeriod[],
    highDebtLowVelocity: [] as ProcessedPeriod[],
    highDebtMedVelocity: [] as ProcessedPeriod[],
    highDebtHighVelocity: [] as ProcessedPeriod[],
  };

  for (const d of finalValidData) {
    const tdrCat = getTDRCategory(d.endTDR);
    const veloCat = getVeloCategory(d.compositeVelocity);

    if (tdrCat === "low" && veloCat === "low")
      frameworkData.lowDebtLowVelocity.push(d);
    else if (tdrCat === "low" && veloCat === "med")
      frameworkData.lowDebtMedVelocity.push(d);
    else if (tdrCat === "low" && veloCat === "high")
      frameworkData.lowDebtHighVelocity.push(d);
    else if (tdrCat === "med" && veloCat === "low")
      frameworkData.medDebtLowVelocity.push(d);
    else if (tdrCat === "med" && veloCat === "med")
      frameworkData.medDebtMedVelocity.push(d);
    else if (tdrCat === "med" && veloCat === "high")
      frameworkData.medDebtHighVelocity.push(d);
    else if (tdrCat === "high" && veloCat === "low")
      frameworkData.highDebtLowVelocity.push(d);
    else if (tdrCat === "high" && veloCat === "med")
      frameworkData.highDebtMedVelocity.push(d);
    else if (tdrCat === "high" && veloCat === "high")
      frameworkData.highDebtHighVelocity.push(d);
  }

  return {
    lowDebtLowVelocity: calculateQuadrantMetrics(
      frameworkData.lowDebtLowVelocity
    ),
    lowDebtMedVelocity: calculateQuadrantMetrics(
      frameworkData.lowDebtMedVelocity
    ),
    lowDebtHighVelocity: calculateQuadrantMetrics(
      frameworkData.lowDebtHighVelocity
    ),
    medDebtLowVelocity: calculateQuadrantMetrics(
      frameworkData.medDebtLowVelocity
    ),
    medDebtMedVelocity: calculateQuadrantMetrics(
      frameworkData.medDebtMedVelocity
    ),
    medDebtHighVelocity: calculateQuadrantMetrics(
      frameworkData.medDebtHighVelocity
    ),
    highDebtLowVelocity: calculateQuadrantMetrics(
      frameworkData.highDebtLowVelocity
    ),
    highDebtMedVelocity: calculateQuadrantMetrics(
      frameworkData.highDebtMedVelocity
    ),
    highDebtHighVelocity: calculateQuadrantMetrics(
      frameworkData.highDebtHighVelocity
    ),
  };
}

export function buildQuartileFramework(
  finalValidData: ProcessedPeriod[]
): QuartileFramework {
  const tdrValues = finalValidData.map((d) => d.endTDR);
  const velocityValues = finalValidData.map((d) => d.compositeVelocity);
  const tdrQuartiles = {
    q1: quantile(tdrValues, 0.25),
    q4: quantile(tdrValues, 0.75),
  };
  const veloQuartiles = {
    q1: quantile(velocityValues, 0.25),
    q4: quantile(velocityValues, 0.75),
  };

  const bottomLeft = finalValidData.filter(
    (d) =>
      d.endTDR <= tdrQuartiles.q1 && d.compositeVelocity <= veloQuartiles.q1
  );
  const bottomRight = finalValidData.filter(
    (d) =>
      d.endTDR >= tdrQuartiles.q4 && d.compositeVelocity <= veloQuartiles.q1
  );
  const topLeft = finalValidData.filter(
    (d) =>
      d.endTDR <= tdrQuartiles.q1 && d.compositeVelocity >= veloQuartiles.q4
  );
  const topRight = finalValidData.filter(
    (d) =>
      d.endTDR >= tdrQuartiles.q4 && d.compositeVelocity >= veloQuartiles.q4
  );

  return {
    bottomLeft: calculateQuadrantMetrics(bottomLeft),
    bottomRight: calculateQuadrantMetrics(bottomRight),
    topLeft: calculateQuadrantMetrics(topLeft),
    topRight: calculateQuadrantMetrics(topRight),
  };
}

export function buildQuartileAnalysis(finalValidData: ProcessedPeriod[]) {
  const length = finalValidData.length;
  const quartileSize = Math.floor(length / 4);

  const tdrSorted = [...finalValidData].sort((a, b) => a.endTDR - b.endTDR);
  const velocitySorted = [...finalValidData].sort(
    (a, b) => a.compositeVelocity - b.compositeVelocity
  );

  const tdrQuartiles = [
    tdrSorted.slice(0, quartileSize),
    tdrSorted.slice(quartileSize, quartileSize * 2),
    tdrSorted.slice(quartileSize * 2, quartileSize * 3),
    tdrSorted.slice(quartileSize * 3),
  ];

  const velocityQuartiles = [
    velocitySorted.slice(0, quartileSize),
    velocitySorted.slice(quartileSize, quartileSize * 2),
    velocitySorted.slice(quartileSize * 2, quartileSize * 3),
    velocitySorted.slice(quartileSize * 3),
  ];
  return { tdrQuartiles, velocityQuartiles };
}

export function buildMarketCategoryAnalysis(
  finalValidData: ProcessedPeriod[]
): MarketCategoryAnalysis[] {
  const byMarketCategory = finalValidData.reduce((acc, d) => {
    const category = d.marketCategory || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category]!.push(d);
    return acc;
  }, {} as Record<string, ProcessedPeriod[]>);
  return Object.entries(byMarketCategory)
    .map(([category, data]) => ({
      category,
      ...calculateQuadrantMetrics(data),
    }))
    .sort((a, b) => b.count - a.count);
}

// ==================== FRAMEWORK ORCHESTRATION ====================

export function buildAnalysisFrameworks(finalValidData: ProcessedPeriod[]) {
  const medianQuadrants = buildMedianQuadrantAnalysis(finalValidData);
  const { tdrQuartiles, velocityQuartiles } =
    buildQuartileAnalysis(finalValidData);
  const marketCategoryAnalysis = buildMarketCategoryAnalysis(finalValidData);
  const tertileFramework = buildTertileFramework(finalValidData);
  const quartileFramework = buildQuartileFramework(finalValidData);

  return {
    medianQuadrants,
    tdrQuartiles,
    velocityQuartiles,
    marketCategoryAnalysis,
    tertileFramework,
    quartileFramework,
  };
}
