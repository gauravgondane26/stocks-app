// Ported from trader-budget/size.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
// Keeps the two limits the build plan asks for, max loss and available cash, and
// leaves out the original's cash buffer, position cap and order-size limits.
// Pure: no database or network.

const EPSILON = 1e-9;

export type SizeLimit = {
  name: "max loss" | "cash";
  shares: number;
  binds: boolean;
};

export type Sizing = {
  // The price the size is worked from: the plan's entry, or a fresh price above it.
  entry: number;
  entryFrom: "plan" | "price";
  riskPerShare: number;
  rewardRisk: number;
  shares: number;
  cost: number;
  lossAtStop: number;
  limits: SizeLimit[];
  boundBy: SizeLimit["name"];
  refusal: string | null;
};

const cents = (value: number) => Math.floor(value * 100 + 0.5 + EPSILON);
const sharesFor = (amount: number, perShare: number) => {
  const amountCents = Math.round(amount * 100);
  const perShareCents = Math.round(perShare * 100);
  return perShareCents > 0 && amountCents > 0
    ? Math.floor(amountCents / perShareCents)
    : 0;
};

export const sizeTrade = ({
  entry,
  stop,
  target,
  latestPrice,
  accountSize,
  maxLossPerTrade,
  minRewardRisk,
  formatMoney,
}: {
  entry: number;
  stop: number;
  target: number;
  // Only a fresh price: a market order fills at the higher of it and the plan's entry.
  latestPrice: number | null;
  accountSize: number;
  maxLossPerTrade: number;
  minRewardRisk: number;
  formatMoney: (value: number) => string;
}): Sizing => {
  const useLatest = latestPrice !== null && cents(latestPrice) > cents(entry);
  const refCents = cents(useLatest ? latestPrice : entry);
  const stopCents = cents(stop);
  const targetCents = cents(target);
  const riskCents = refCents - stopCents;
  const rewardCents = targetCents - refCents;
  const ref = refCents / 100;
  const risk = riskCents / 100;

  const base = {
    entry: ref,
    entryFrom: useLatest ? ("price" as const) : ("plan" as const),
    riskPerShare: risk,
    rewardRisk: riskCents > 0 ? Math.round((rewardCents / riskCents) * 100) / 100 : 0,
  };

  if (riskCents <= 0) {
    return {
      ...base,
      shares: 0,
      cost: 0,
      lossAtStop: 0,
      limits: [],
      boundBy: "max loss",
      refusal: `the price ${formatMoney(ref)} is at or below the stop ${formatMoney(stopCents / 100)}: the setup has failed. Skip it.`,
    };
  }
  if (rewardCents <= 0) {
    return {
      ...base,
      shares: 0,
      cost: 0,
      lossAtStop: 0,
      limits: [],
      boundBy: "max loss",
      refusal: `the price ${formatMoney(ref)} is already at or above the target ${formatMoney(targetCents / 100)}: the move has happened. Skip it or make a new plan.`,
    };
  }

  const limits: SizeLimit[] = [
    { name: "max loss", shares: sharesFor(maxLossPerTrade, risk), binds: false },
    { name: "cash", shares: sharesFor(accountSize, ref), binds: false },
  ];
  const shares = Math.max(0, Math.min(...limits.map((limit) => limit.shares)));
  const boundBy = limits.find((limit) => limit.shares === shares)!.name;
  for (const limit of limits) limit.binds = limit.name === boundBy;

  let refusal: string | null = null;
  if (shares === 0) {
    refusal =
      boundBy === "max loss"
        ? `one share risks ${formatMoney(risk)}, more than your ${formatMoney(maxLossPerTrade)} max loss per trade. Skip this trade, or plan a closer stop.`
        : `one share costs ${formatMoney(ref)}, more than your ${formatMoney(accountSize)} account.`;
  } else if (minRewardRisk && rewardCents < minRewardRisk * riskCents - EPSILON) {
    refusal = `reward:risk ${base.rewardRisk.toFixed(2)} is under your minimum ${minRewardRisk}. Skip it, or plan a farther target.`;
  }

  return {
    ...base,
    shares,
    cost: Math.round(shares * refCents) / 100,
    lossAtStop: Math.round(shares * riskCents) / 100,
    limits,
    boundBy,
    refusal,
  };
};
