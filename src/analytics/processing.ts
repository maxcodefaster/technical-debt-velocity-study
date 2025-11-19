import { alias } from "drizzle-orm/sqlite-core";
import { db } from "../db/db";
import {
  companies,
  fundingRounds,
  developmentPeriods,
  codeSnapshots,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

// ==================== INTERFACES ====================

export interface ProcessedPeriod {
  companyId: number;
  companyName: string;
  marketCategory: string;
  periodDays: number;
  commitCount: number;
  authorCount: number;
  gotNextRound: boolean;
  fromLOC: number;
  toLOC: number;
  avgLOC: number;
  fundingGrowthRate: number;
  startTDR: number;
  endTDR: number;
  tdrChange: number;
  commitVelocity: number;
  locChurn: number;
  compositeVelocity: number;
}

// ==================== BUSINESS LOGIC UTILITIES ====================

export function calculateTechnicalDebtRatio(
  linesOfCode: number,
  totalEffortMinutes: number
): number {
  if (linesOfCode <= 0) return 0;
  const kloc = linesOfCode / 1000;
  const effortPersonMonths = 2.4 * Math.pow(kloc, 1.05);
  const estimatedDevMinutes = effortPersonMonths * 152 * 60;
  if (estimatedDevMinutes <= 0) return 0;
  const tdr = totalEffortMinutes / estimatedDevMinutes;
  return Math.min(Math.max(tdr, 0), 1.0);
}

export function isValidRecord(d: ProcessedPeriod): boolean {
  const validTDR =
    d.startTDR >= 0 && d.startTDR <= 1 && d.endTDR >= 0 && d.endTDR <= 1;
  const sufficientCode = d.avgLOC >= 5000;
  const validPeriod = d.periodDays >= 90;
  const hasActivity = d.commitCount > 10;
  return validTDR && sufficientCode && validPeriod && hasActivity;
}

export function calculateVelocityMetrics(
  data: ProcessedPeriod[]
): ProcessedPeriod[] {
  if (data.length === 0) return data;

  let maxChurnPerAuthor = 0;
  let maxCommitsPerAuthor = 0;

  const dataWithMetrics = data.map((d) => {
    const commitVelocity = d.commitCount / d.periodDays;
    const locChurn = Math.abs(d.toLOC - d.fromLOC) / d.periodDays;
    const authorCount = Math.max(d.authorCount, 1);
    const locChurnPerAuthor = locChurn / authorCount;
    const commitsPerAuthor = commitVelocity / authorCount;

    maxChurnPerAuthor = Math.max(maxChurnPerAuthor, locChurnPerAuthor);
    maxCommitsPerAuthor = Math.max(maxCommitsPerAuthor, commitsPerAuthor);

    return {
      ...d,
      commitVelocity,
      locChurn,
      locChurnPerAuthor,
      commitsPerAuthor,
    };
  });

  return dataWithMetrics.map((d) => {
    const normalizedChurnPerAuthor =
      maxChurnPerAuthor > 0 ? d.locChurnPerAuthor / maxChurnPerAuthor : 0;
    const normalizedCommitsPerAuthor =
      maxCommitsPerAuthor > 0 ? d.commitsPerAuthor / maxCommitsPerAuthor : 0;

    return {
      ...d,
      compositeVelocity:
        (normalizedChurnPerAuthor + normalizedCommitsPerAuthor) / 2,
    };
  });
}

// ==================== DATA PROCESSING PIPELINE ====================

export async function fetchRawData() {
  const fromSnapshot = alias(codeSnapshots, "fromSnapshot");
  const toSnapshot = alias(codeSnapshots, "toSnapshot");

  return db
    .select({
      period: developmentPeriods,
      fromSnapshot: fromSnapshot,
      toSnapshot: toSnapshot,
      company: companies,
    })
    .from(developmentPeriods)
    .leftJoin(
      fromSnapshot,
      and(
        eq(fromSnapshot.companyId, developmentPeriods.companyId),
        eq(fromSnapshot.fundingRoundId, developmentPeriods.fromRoundId!)
      )
    )
    .leftJoin(
      toSnapshot,
      and(
        eq(toSnapshot.companyId, developmentPeriods.companyId),
        eq(toSnapshot.fundingRoundId, developmentPeriods.toRoundId!)
      )
    )
    .leftJoin(companies, eq(companies.id, developmentPeriods.companyId));
}

export async function processRawData(
  allPeriodData: any[]
): Promise<ProcessedPeriod[]> {
  const fromRoundIds = new Set<number>();
  const toRoundIds = new Set<number>();

  allPeriodData.forEach((row) => {
    if (row.period.fromRoundId) fromRoundIds.add(row.period.fromRoundId);
    if (row.period.toRoundId) toRoundIds.add(row.period.toRoundId);
  });

  const allRoundIds = [...fromRoundIds, ...toRoundIds];
  const fundingRoundsMap = new Map<number, any>();

  if (allRoundIds.length > 0) {
    const rounds = await db
      .select()
      .from(fundingRounds)
      .where(inArray(fundingRounds.id, allRoundIds));
    rounds.forEach((round) => fundingRoundsMap.set(round.id, round));
  }

  return allPeriodData.map((row) => {
    const period = row.period;
    const fromRound = period.fromRoundId
      ? fundingRoundsMap.get(period.fromRoundId)
      : null;
    const toRound = period.toRoundId
      ? fundingRoundsMap.get(period.toRoundId)
      : null;

    const fromAmount = fromRound?.amountUsd || 0;
    const toAmount = toRound?.amountUsd || 0;
    const fundingGrowthRate =
      fromAmount > 0 ? ((toAmount - fromAmount) / fromAmount) * 100 : 0;

    const fromLOC = row.fromSnapshot?.linesOfCode || 0;
    const toLOC = row.toSnapshot?.linesOfCode || 0;

    const startTDR = calculateTechnicalDebtRatio(
      fromLOC,
      row.fromSnapshot?.totalEffortMinutes || 0
    );
    const endTDR = calculateTechnicalDebtRatio(
      toLOC,
      row.toSnapshot?.totalEffortMinutes || 0
    );
    const tdrChange = startTDR > 0 ? ((endTDR - startTDR) / startTDR) * 100 : 0;

    return {
      companyId: period.companyId,
      companyName: row.company?.name ?? "Unknown",
      marketCategory: row.company?.marketCategory ?? "Unknown",
      periodDays: period.periodDays || 0,
      commitCount: period.commitCount || 0,
      authorCount: period.authorCount || 0,
      gotNextRound: period.gotNextRound || false,
      fromLOC,
      toLOC,
      avgLOC: (fromLOC + toLOC) / 2,
      fundingGrowthRate,
      startTDR,
      endTDR,
      tdrChange,
      commitVelocity: 0,
      locChurn: 0,
      compositeVelocity: 0,
    };
  });
}

export async function validateAndProcessData(allPeriodData: any[]) {
  const totalRecords = allPeriodData.length;
  const processedData = await processRawData(allPeriodData);
  const recordsWithValidTDR = processedData.filter(
    (d) => d.startTDR >= 0 && d.startTDR <= 1 && d.endTDR >= 0 && d.endTDR <= 1
  ).length;
  const recordsWithSufficientCode = processedData.filter(
    (d) => d.avgLOC >= 5000
  ).length;
  const validData = processedData.filter(isValidRecord);
  return {
    totalRecords,
    recordsWithValidTDR,
    recordsWithSufficientCode,
    finalValidData: calculateVelocityMetrics(validData),
  };
}
