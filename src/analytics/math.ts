import { cumulativeStdNormalProbability, quantile } from "simple-statistics";

// ==================== PURE MATHEMATICAL UTILITIES ====================

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  return quantile(values, 0.5);
}

export function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lowerBound && v <= upperBound);
}

export function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2 || x.length !== y.length) return 0;
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  const numerator = x.reduce(
    (sum, val, i) => sum + (val - meanX) * (y[i]! - meanY),
    0
  );
  const denomX = Math.sqrt(
    x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0)
  );
  const denomY = Math.sqrt(
    y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0)
  );
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / (denomX * denomY);
}

export function calculatePValue(correlation: number, n: number): number {
  if (n <= 2) return 1.0;
  if (Math.abs(correlation) >= 1.0) return 0.0;
  const tStatistic =
    correlation * Math.sqrt((n - 2) / (1 - Math.pow(correlation, 2)));
  if (!isFinite(tStatistic)) return 1.0;
  return 2 * (1 - cumulativeStdNormalProbability(Math.abs(tStatistic)));
}

export function getSignificanceLevel(pValue: number): string {
  if (pValue < 0.001) return "Highly Significant (p<0.001)";
  if (pValue < 0.01) return "Significant (p<0.01)";
  if (pValue < 0.05) return "Significant (p<0.05)";
  if (pValue < 0.1) return "Marginally Significant (p<0.1)";
  return "Not Significant";
}
