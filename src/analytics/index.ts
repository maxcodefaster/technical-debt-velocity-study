import { fetchRawData, validateAndProcessData } from "./processing";
import { buildAnalysisFrameworks, type QuadrantMetrics } from "./frameworks";
import {
  type EntrepreneurshipAnalysis,
  performStatisticalAnalysis,
  buildFinalResult,
} from "./insights";

// ==================== MAIN ANALYSIS ORCHESTRATION ====================

export async function analyseGrowthDynamics(): Promise<EntrepreneurshipAnalysis> {
  // Step 1: Fetch and validate data
  const allPeriodData = await fetchRawData();
  const {
    totalRecords,
    recordsWithValidTDR,
    recordsWithSufficientCode,
    finalValidData,
  } = await validateAndProcessData(allPeriodData);

  // Step 2: Handle insufficient data case
  if (finalValidData.length < 20) {
    return createInsufficientDataResponse(
      totalRecords,
      recordsWithValidTDR,
      recordsWithSufficientCode,
      finalValidData.length
    );
  }

  // Step 3: Perform statistical analysis
  const stats = performStatisticalAnalysis(finalValidData);

  // Step 4: Build strategic frameworks
  const analysisResults = buildAnalysisFrameworks(finalValidData);

  // Step 5: Generate final comprehensive result
  return buildFinalResult(
    finalValidData,
    totalRecords,
    recordsWithValidTDR,
    recordsWithSufficientCode,
    stats,
    analysisResults
  );
}

// ==================== ERROR HANDLING ====================

function createInsufficientDataResponse(
  totalRecords: number,
  recordsWithValidTDR: number,
  recordsWithSufficientCode: number,
  validDataPoints: number
): EntrepreneurshipAnalysis {
  const emptyQuadrant: QuadrantMetrics = {
    count: 0,
    avgFundingGrowth: 0,
    successRate: 0,
    avgTDR: 0,
    avgVelocity: 0,
  };

  const emptyTertileFramework = {
    lowDebtLowVelocity: emptyQuadrant,
    lowDebtMedVelocity: emptyQuadrant,
    lowDebtHighVelocity: emptyQuadrant,
    medDebtLowVelocity: emptyQuadrant,
    medDebtMedVelocity: emptyQuadrant,
    medDebtHighVelocity: emptyQuadrant,
    highDebtLowVelocity: emptyQuadrant,
    highDebtMedVelocity: emptyQuadrant,
    highDebtHighVelocity: emptyQuadrant,
  };

  const emptyQuartileFramework = {
    bottomLeft: emptyQuadrant,
    bottomRight: emptyQuadrant,
    topLeft: emptyQuadrant,
    topRight: emptyQuadrant,
  };

  return {
    summary: {
      totalVentures: 0,
      validDataPoints: 0,
      filteredDataPoints: totalRecords,
      avgFundingGrowthRate: 0,
      avgDaysBetweenRounds: 0,
      avgTechnicalDebtRatio: 0,
      avgDevelopmentVelocity: 0,
      fundingSuccessRate: 0,
    },
    dataQuality: {
      totalRecords,
      recordsWithValidTDR,
      recordsWithSufficientCode,
      recordsUsedInAnalysis: validDataPoints,
      filteringReason:
        "Insufficient valid data points (<20) after quality filtering.",
    },
    strategicFramework: {
      lowDebtHighVelocity: emptyQuadrant,
      highDebtHighVelocity: emptyQuadrant,
      lowDebtLowVelocity: emptyQuadrant,
      highDebtLowVelocity: emptyQuadrant,
    },
    sensitivityAnalysis: {
      tertileFramework: emptyTertileFramework,
      quartileFramework: emptyQuartileFramework,
    },
    statisticalAnalysis: {
      correlation_TDR_velocity: 0,
      correlation_TDR_funding: 0,
      correlation_velocity_funding: 0,
      correlation_TDRchange_funding: 0,
      correlation_TDR_velocity_by_company: 0,
      pValue_by_company: 1,
      significanceLevel_by_company: "not significant",
      regressionSlope: 0,
      rSquared: 0,
      pValue: 1,
      significanceLevel: "not significant",
      pValue_TDR_funding: 1,
      pValue_velocity_funding: 1,
      pValue_TDRchange_funding: 1,
    },
    fundingAnalysis: {
      byTDRQuartile: [],
      byVelocityQuartile: [],
      byMarketCategory: [],
    },
    insights: {
      primaryFinding: "Insufficient data for analysis.",
      dataQualityNote: `Only ${validDataPoints} of ${totalRecords} records passed quality filters.`,
      practicalImplication: "Cannot draw conclusions.",
      limitations: "Insufficient valid data.",
    },
    exportDate: new Date().toISOString(),
  };
}

// ==================== EXPORTS ====================

// Re-export types for external use
export type { EntrepreneurshipAnalysis } from "./insights";
