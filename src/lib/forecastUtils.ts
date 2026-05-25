import * as ss from "simple-statistics";
import { PolynomialRegression } from "ml-regression";
 
// ── LINEAR REGRESSION (simple-statistics) ──────────────────────────────────
export function getLinearPredictions(data: number[], stepsAhead: number = 3) {
  if (data.length < 2)
    return {
      predicted: [],
      slope: 0,
      intercept: 0,
      rSquared: 0,
      line: (x: number) => 0,
    };
 
  const points: [number, number][] = data.map((y, x) => [x, y]);
  const regression = ss.linearRegression(points);
  const line = ss.linearRegressionLine(regression);
  const rSquared = ss.rSquared(points, line);
 
  const predicted: number[] = [];
  for (let i = 0; i < stepsAhead; i++) {
    predicted.push(Math.max(0, Math.round(line(data.length + i))));
  }
 
  return {
    predicted,
    slope: regression.m,
    intercept: regression.b,
    rSquared,
    line,
  };
}
 
// ── POLYNOMIAL REGRESSION (ml-regression) ──────────────────────────────────
export function getPolynomialPredictions(
  data: number[],
  stepsAhead: number = 3,
  degree: number = 2,
) {
  if (data.length < 3) return { predicted: [], stdDev: 0 };
 
  const xs = data.map((_, i) => i);
  const ys = [...data];
  const reg = new PolynomialRegression(xs, ys, degree);
 
  const predicted: number[] = [];
  for (let i = 0; i < stepsAhead; i++) {
    predicted.push(Math.max(0, Math.round(reg.predict(data.length + i))));
  }
 
  const residuals = data.map((actual, i) => actual - reg.predict(i));
  const stdDev = ss.standardDeviation(residuals);
 
  return { predicted, stdDev };
}
 
// ── COMBINED FORECAST ───────────────────────────────────────────────────────
export function buildForecast(data: number[], stepsAhead: number = 3) {
  if (data.length < 2) return null;
 
  const linear = getLinearPredictions(data, stepsAhead);
  const poly = getPolynomialPredictions(data, stepsAhead);
 
  return {
    linear,
    poly,
    bestPredicted: linear.rSquared >= 0.85 ? linear.predicted : poly.predicted,
    confidenceBand: poly.stdDev,
    trend:
      linear.slope > 1 ? "rising" : linear.slope < -1 ? "falling" : "stable",
  };
}
 
// ── INVENTORY STATS (simple-statistics) ────────────────────────────────────
export function computeInventoryStats(
  burnRates: number[],
  stockLevels: number[],
) {
  if (burnRates.length === 0) return null;
 
  return {
    meanBurnRate: ss.mean(burnRates),
    medianBurnRate: ss.median(burnRates),
    burnRateStdDev: ss.standardDeviation(burnRates),
    highBurnOutliers: burnRates.filter(
      (r) => r > ss.mean(burnRates) + ss.standardDeviation(burnRates),
    ).length,
    stockBurnCorrelation:
      burnRates.length > 1
        ? ss.sampleCorrelation(burnRates, stockLevels).toFixed(2)
        : "N/A",
  };
}
 
// ── PROCUREMENT ROWS ────────────────────────────────────────────────────────
export function buildProcurementRows(consumableBurnRate: any[]) {
  return consumableBurnRate.map((item) => {
    const predDemand = Math.round(item.weeklyBurnRate * 4.33);
    const safetyStock = Math.round(item.weeklyBurnRate * 2);
    const suggestedOrder = Math.max(
      0,
      safetyStock + predDemand - item.currentStock,
    );
 
    // ── FIXED: zero-stock items must never show "∞ weeks left" ──────────────
    // Old logic:  burnRate > 0 ? stock/burnRate : Infinity
    //   → items with 0 stock AND 0 burn rate got Infinity → always "ok"
    //
    // New logic priority:
    //   1. stock is 0              → 0 weeks left (order immediately)
    //   2. burn rate is known > 0  → stock / burnRate
    //   3. stock > 0, no burn data → Infinity (genuinely unknown, flag as ok)
    const weeksLeft =
      item.currentStock <= 0
        ? 0                                          // out of stock → order now
        : item.weeklyBurnRate > 0
        ? item.currentStock / item.weeklyBurnRate    // normal calculation
        : Infinity;                                  // has stock, no usage data
 
    // ── STATUS thresholds ────────────────────────────────────────────────────
    //   0 weeks  → order (out of stock)
    //  <4 weeks  → order (critically low)
    //  <8 weeks  → watch (getting low)
    //   else     → ok
    const status: "order" | "watch" | "ok" =
      weeksLeft <= 0 ? "order"
      : weeksLeft < 4 ? "order"
      : weeksLeft < 8 ? "watch"
      : "ok";
 
    return {
      description: item.description,
      currentStock: item.currentStock,
      weeklyBurnRate: item.weeklyBurnRate,
      weeksLeft: isFinite(weeksLeft) ? weeksLeft.toFixed(1) : "∞",
      predDemand,
      suggestedOrder,
      status,
    };
  });
}