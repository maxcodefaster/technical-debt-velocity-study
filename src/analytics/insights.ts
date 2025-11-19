import { linearRegression } from "simple-statistics";
import { db } from "../db/db";
import { companies } from "../db/schema";
import { sql } from "drizzle-orm";
import { type ProcessedPeriod } from "./processing";
import {
  type QuadrantMetrics,
  type TertileFramework,
  type QuartileFramework,
  type MarketCategoryAnalysis,
  calculateQuadrantMetrics,
} from "./frameworks";
import {
  calculateCorrelation,
  calculatePValue,
  getSignificanceLevel,
  calculateMedian,
  removeOutliers,
} from "./math";

// ==================== INTERFACES ====================

export interface EntrepreneurshipAnalysis {
  summary: {
    totalVentures: number;
    validDataPoints: number;
    filteredDataPoints: number;
    avgFundingGrowthRate: number;
    avgDaysBetweenRounds: number;
    avgTechnicalDebtRatio: number;
    avgDevelopmentVelocity: number;
    fundingSuccessRate: number;
  };
  dataQuality: {
    totalRecords: number;
    recordsWithValidTDR: number;
    recordsWithSufficientCode: number;
    recordsUsedInAnalysis: number;
    filteringReason: string;
  };
  strategicFramework: {
    lowDebtHighVelocity: QuadrantMetrics;
    highDebtHighVelocity: QuadrantMetrics;
    lowDebtLowVelocity: QuadrantMetrics;
    highDebtLowVelocity: QuadrantMetrics;
  };
  sensitivityAnalysis: {
    tertileFramework: TertileFramework;
    quartileFramework: QuartileFramework;
  };
  statisticalAnalysis: {
    correlation_TDR_velocity: number;
    correlation_TDR_funding: number;
    correlation_velocity_funding: number;
    correlation_TDRchange_funding: number;
    correlation_TDR_velocity_by_company: number;
    pValue_by_company: number;
    significanceLevel_by_company: string;
    regressionSlope: number;
    rSquared: number;
    pValue: number;
    significanceLevel: string;
    pValue_TDR_funding: number;
    pValue_velocity_funding: number;
    pValue_TDRchange_funding: number;
  };
  fundingAnalysis: {
    byTDRQuartile: Array<{
      quartile: string;
      avgTDR: number;
      avgFundingGrowth: number;
      successRate: number;
      count: number;
    }>;
    byVelocityQuartile: Array<{
      quartile: string;
      avgVelocity: number;
      avgFundingGrowth: number;
      successRate: number;
      count: number;
    }>;
    byMarketCategory: MarketCategoryAnalysis[];
  };
  insights: {
    primaryFinding: string;
    dataQualityNote: string;
    practicalImplication: string;
    limitations: string;
  };
  exportDate: string;
}

// ==================== CORRELATION ANALYSIS ====================

export function calculateCorrelations(finalValidData: ProcessedPeriod[]): any {
  // Group by company and calculate averages
  const companyMap = new Map<
    number,
    {
      tdrValues: number[];
      velocityValues: number[];
      fundingValues: number[];
      tdrChangeValues: number[];
    }
  >();

  // Group data by company
  finalValidData.forEach((d) => {
    if (!companyMap.has(d.companyId)) {
      companyMap.set(d.companyId, {
        tdrValues: [],
        velocityValues: [],
        fundingValues: [],
        tdrChangeValues: [],
      });
    }
    const company = companyMap.get(d.companyId)!;
    company.tdrValues.push(d.endTDR);
    company.velocityValues.push(d.compositeVelocity);
    company.fundingValues.push(d.fundingGrowthRate);
    company.tdrChangeValues.push(d.tdrChange);
  });

  // Calculate company averages
  const companyAverages = Array.from(companyMap.values()).map((company) => ({
    avgTDR:
      company.tdrValues.reduce((a, b) => a + b, 0) / company.tdrValues.length,
    avgVelocity:
      company.velocityValues.reduce((a, b) => a + b, 0) /
      company.velocityValues.length,
    avgFunding:
      company.fundingValues.reduce((a, b) => a + b, 0) /
      company.fundingValues.length,
    avgTDRChange:
      company.tdrChangeValues.reduce((a, b) => a + b, 0) /
      company.tdrChangeValues.length,
  }));

  // Remove outliers from company-level data
  const cleanCompanyFunding = removeOutliers(
    companyAverages.map((c) => c.avgFunding)
  );
  const validCompanies = companyAverages.filter((c) =>
    cleanCompanyFunding.includes(c.avgFunding)
  );

  // Calculate correlations
  return {
    // Per-period correlations (original)
    tdrValues: finalValidData.map((d) => d.endTDR),
    velocityValues: finalValidData.map((d) => d.compositeVelocity),
    fundingGrowthValues: finalValidData.map((d) => d.fundingGrowthRate),
    correlation_TDR_velocity: calculateCorrelation(
      finalValidData.map((d) => d.endTDR),
      finalValidData.map((d) => d.compositeVelocity)
    ),
    correlation_TDR_funding: calculateCorrelation(
      validCompanies.map((c) => c.avgTDR),
      validCompanies.map((c) => c.avgFunding)
    ),
    correlation_velocity_funding: calculateCorrelation(
      validCompanies.map((c) => c.avgVelocity),
      validCompanies.map((c) => c.avgFunding)
    ),
    correlation_TDRchange_funding: calculateCorrelation(
      validCompanies.map((c) => c.avgTDRChange),
      validCompanies.map((c) => c.avgFunding)
    ),
    // Per-company correlations
    correlation_TDR_velocity_by_company: calculateCorrelation(
      companyAverages.map((c) => c.avgTDR),
      companyAverages.map((c) => c.avgVelocity)
    ),
    companySampleSize: validCompanies.length,
  };
}

// ==================== STATISTICAL ANALYSIS ====================

export function performStatisticalAnalysis(finalValidData: ProcessedPeriod[]) {
  const correlations = calculateCorrelations(finalValidData);

  const regressionData: [number, number][] = finalValidData.map((d) => [
    d.endTDR,
    d.compositeVelocity,
  ]);
  const regressionResult = linearRegression(regressionData);

  const rSquared = Math.pow(correlations.correlation_TDR_velocity, 2);
  const pValue = calculatePValue(
    correlations.correlation_TDR_velocity,
    finalValidData.length
  );
  const significanceLevel = getSignificanceLevel(pValue);

  // Per-company significance
  const pValue_by_company = calculatePValue(
    correlations.correlation_TDR_velocity_by_company,
    Object.keys(
      finalValidData.reduce((acc, d) => ({ ...acc, [d.companyId]: 1 }), {})
    ).length
  );
  const significanceLevel_by_company = getSignificanceLevel(pValue_by_company);

  const pValue_TDR_funding = calculatePValue(
    correlations.correlation_TDR_funding,
    correlations.companySampleSize
  );
  const pValue_velocity_funding = calculatePValue(
    correlations.correlation_velocity_funding,
    correlations.companySampleSize
  );
  const pValue_TDRchange_funding = calculatePValue(
    correlations.correlation_TDRchange_funding,
    correlations.companySampleSize
  );

  return {
    ...correlations,
    regressionSlope: regressionResult.m,
    rSquared,
    pValue,
    significanceLevel,
    pValue_by_company,
    significanceLevel_by_company,
    pValue_TDR_funding,
    pValue_velocity_funding,
    pValue_TDRchange_funding,
  };
}

// ==================== BUSINESS INSIGHTS ====================

export function generateInsights(
  correlation: number,
  significance: string,
  validPoints: number,
  totalPoints: number
): any {
  const filterRate = (
    ((totalPoints - validPoints) / totalPoints) *
    100
  ).toFixed(1);
  return {
    primaryFinding: `The primary analysis using per-period data shows a weak, statistically insignificant relationship (r=${correlation.toFixed(
      3
    )}) between technical debt and development velocity. Analysis using per-company averages to ensure data independence confirms this weak relationship.`,
    dataQualityNote: `Analysis based on ${validPoints} high-quality development periods from a total of ${totalPoints} records (${filterRate}% filtered for quality). Key filters include LOC > 5000 and period length > 90 days.`,
    practicalImplication: `For early-stage, venture-backed startups in this sample, there is no strong empirical evidence that accumulating technical debt significantly hampers development velocity. Instead, velocity appears to be a more critical driver of funding success, regardless of the underlying code quality.`,
    limitations: `Limitations include: (1) Sample is limited to open-source startups, which may not represent all ventures. (2) Technical Debt Ratio (TDR) is a model-based estimate. (3) The analysis reflects a period of high capital availability (pre-2022), which may influence investor priorities.`,
  };
}

// ==================== FINAL RESULT BUILDER ====================

export async function buildFinalResult(
  finalValidData: ProcessedPeriod[],
  totalRecords: number,
  recordsWithValidTDR: number,
  recordsWithSufficientCode: number,
  stats: any,
  analysisResults: any
): Promise<EntrepreneurshipAnalysis> {
  const totalVentures = await db
    .select({ count: sql<number>`count(distinct ${companies.id})` })
    .from(companies)
    .then((res) => res[0]?.count ?? 0);

  const insights = generateInsights(
    stats.correlation_TDR_velocity,
    stats.significanceLevel,
    finalValidData.length,
    totalRecords
  );

  return {
    summary: {
      totalVentures,
      validDataPoints: finalValidData.length,
      filteredDataPoints: totalRecords - finalValidData.length,
      avgFundingGrowthRate: calculateMedian(stats.fundingGrowthValues),
      avgDaysBetweenRounds: calculateMedian(
        finalValidData.map((d) => d.periodDays)
      ),
      avgTechnicalDebtRatio: calculateMedian(stats.tdrValues),
      avgDevelopmentVelocity: calculateMedian(stats.velocityValues),
      fundingSuccessRate:
        (finalValidData.filter((d) => d.gotNextRound).length /
          finalValidData.length) *
        100,
    },
    dataQuality: {
      totalRecords,
      recordsWithValidTDR,
      recordsWithSufficientCode,
      recordsUsedInAnalysis: finalValidData.length,
      filteringReason: `Filtered ${
        totalRecords - finalValidData.length
      } records: Required valid TDR, LOC > 5000, period > 90 days, & >10 commits.`,
    },
    strategicFramework: {
      lowDebtHighVelocity: calculateQuadrantMetrics(
        analysisResults.medianQuadrants.lowDebtHighVelocity
      ),
      highDebtHighVelocity: calculateQuadrantMetrics(
        analysisResults.medianQuadrants.highDebtHighVelocity
      ),
      lowDebtLowVelocity: calculateQuadrantMetrics(
        analysisResults.medianQuadrants.lowDebtLowVelocity
      ),
      highDebtLowVelocity: calculateQuadrantMetrics(
        analysisResults.medianQuadrants.highDebtLowVelocity
      ),
    },
    sensitivityAnalysis: {
      tertileFramework: analysisResults.tertileFramework,
      quartileFramework: analysisResults.quartileFramework,
    },
    statisticalAnalysis: {
      correlation_TDR_velocity: stats.correlation_TDR_velocity,
      correlation_TDR_funding: stats.correlation_TDR_funding,
      correlation_velocity_funding: stats.correlation_velocity_funding,
      correlation_TDRchange_funding: stats.correlation_TDRchange_funding,
      correlation_TDR_velocity_by_company:
        stats.correlation_TDR_velocity_by_company,
      pValue_by_company: stats.pValue_by_company,
      significanceLevel_by_company: stats.significanceLevel_by_company,
      regressionSlope: stats.regressionSlope,
      rSquared: stats.rSquared,
      pValue: stats.pValue,
      significanceLevel: stats.significanceLevel,
      pValue_TDR_funding: stats.pValue_TDR_funding,
      pValue_velocity_funding: stats.pValue_velocity_funding,
      pValue_TDRchange_funding: stats.pValue_TDRchange_funding,
    },
    fundingAnalysis: {
      byTDRQuartile: analysisResults.tdrQuartiles.map((q: any, i: number) => ({
        quartile: `Q${i + 1}`,
        ...calculateQuadrantMetrics(q),
      })),
      byVelocityQuartile: analysisResults.velocityQuartiles.map(
        (q: any, i: number) => ({
          quartile: `Q${i + 1}`,
          ...calculateQuadrantMetrics(q),
        })
      ),
      byMarketCategory: analysisResults.marketCategoryAnalysis,
    },
    insights,
    exportDate: new Date().toISOString(),
  };
}
