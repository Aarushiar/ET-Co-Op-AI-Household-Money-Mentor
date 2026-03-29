"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HouseholdOptimizationResult } from "@/src/types/tax";

type HouseholdFlowChartProps = {
  result: HouseholdOptimizationResult;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.max(0, Math.round(value)));
}

function formatCompact(value: number): string {
  return compactFormatter.format(Math.max(0, Math.round(value)));
}

export function HouseholdFlowChart({ result }: HouseholdFlowChartProps) {
  const totalIncome = result.household.totalIncome;
  const optimizedTax = result.household.totalOptimizedBestTax;
  const totalSip = result.household.totalSip;
  const postTaxIncome = Math.max(0, totalIncome - optimizedTax);
  const netAfterTaxAndSip = Math.max(0, postTaxIncome - totalSip);

  const barData = [
    { stage: "Income", amount: totalIncome, color: "#0f766e" },
    { stage: "Tax", amount: optimizedTax, color: "#dc2626" },
    { stage: "SIP", amount: totalSip, color: "#2563eb" },
    {
      stage: "Net Savings",
      amount: netAfterTaxAndSip,
      color: "#16a34a",
    },
  ];

  const gridColor = "var(--chart-grid)";

  return (
    <section className="sota-card border border-slate-200 p-4 text-slate-700 transition-colors dark:border-slate-700 dark:text-slate-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[var(--font-space-grotesk)] text-sm font-bold text-slate-900 dark:text-slate-100">
            Visual Flow: Income to Tax to Savings
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            A quick visual of how household income moves through tax and investments.
          </p>
        </div>
        <p className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-300">
          {formatCurrency(result.household.leakageDetected)} Tax Leakage Detected
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
        <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-1 dark:border-teal-900/50 dark:bg-teal-500/10">Income: {formatCurrency(totalIncome)}</span>
        <span>{"->"}</span>
        <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-1 dark:border-rose-900/50 dark:bg-rose-500/10">Tax: {formatCurrency(optimizedTax)}</span>
        <span>{"->"}</span>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 dark:border-blue-900/50 dark:bg-blue-500/10">SIP: {formatCurrency(totalSip)}</span>
        <span>{"->"}</span>
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 dark:border-emerald-900/50 dark:bg-emerald-500/10">
          Net Savings: {formatCurrency(netAfterTaxAndSip)}
        </span>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "currentColor" }} />
            <YAxis
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickFormatter={(value) => formatCompact(Number(value))}
            />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
              {barData.map((entry) => (
                <Cell key={entry.stage} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
