# Impact Model - ET Co-Op AI Household Money Mentor

## Goal

Estimate business impact in three dimensions:

1. Time saved in planning and execution.
2. Cost reduced in delivery operations.
3. Financial value recovered from tax leakage (and optional monetization).

## Assumptions (Base Case)

### Volume and operating assumptions

1. Households served per year: 500
2. Fully loaded analyst/operations cost: INR 900 per hour

### Manual workflow effort per household (before ET Co-Op)

1. Data collection and sanity checks: 35 minutes
2. Old/new regime comparison and deduction review: 40 minutes
3. Additional tax-leakage and allocation verification: 30 minutes
4. Recommendation write-up: 20 minutes
5. Drafting two HR emails: 20 minutes
6. Final quality check and corrections: 15 minutes
7. Total manual time: 160 minutes

### ET Co-Op workflow effort per household (after ET Co-Op)

1. Input capture and validation in UI: 25 minutes
2. Optimization run and review: 10 minutes
3. AI narrative and HR draft generation: 7 minutes
4. Final review and action execution: 8 minutes
5. Total assisted time: 50 minutes

Assumption note: The current judge-facing build uses a deterministic UI success action for `Approve & Send to HR`; the 8-minute step models production-intent execution behavior including review and handoff.

### Financial recovery assumptions

1. Average tax leakage identified per household: INR 60,000
2. First-year realization rate (implemented recommendations): 35%

### Optional monetization assumptions

1. Conversion to premium support tier: 10% of households
2. Annual premium support fee: INR 2,000 per converted household

## Back-of-Envelope Math

### 1) Time saved

Time saved per household:

$$
160 - 50 = 110 \text{ minutes} = 1.83 \text{ hours}
$$

Annual time saved:

$$
500 \times 1.83 = 915 \text{ hours/year}
$$

### 2) Cost reduced

Annual delivery cost reduced:

$$
915 \times 900 = 823{,}500 \text{ INR/year}
$$

Approximate: INR 8.24 lakh/year

### 3) Financial value recovered

Annual tax value recovered for households:

$$
500 \times 60{,}000 \times 0.35 = 10{,}500{,}000 \text{ INR/year}
$$

Approximate: INR 1.05 crore/year

### 4) Optional revenue recovered (monetized service layer)

$$
500 \times 0.10 \times 2{,}000 = 100{,}000 \text{ INR/year}
$$

Approximate: INR 1.0 lakh/year

## Scenario Sensitivity

| Scenario | Households/year | Time saved per household | Cost reduced/year | Leakage/household | Realization | Value recovered/year |
|---|---:|---:|---:|---:|---:|---:|
| Low | 300 | 90 min (1.5 h) | INR 405,000 | INR 45,000 | 25% | INR 3,375,000 |
| Base | 500 | 110 min (1.83 h) | INR 823,500 | INR 60,000 | 35% | INR 10,500,000 |
| High | 1,000 | 120 min (2.0 h) | INR 1,800,000 | INR 75,000 | 40% | INR 30,000,000 |

## Interpretation

1. The strongest impact is value recovery from reducing tax leakage for households.
2. Operational savings are material and predictable even without external AI/email keys.
3. Full provider integration (OpenAI + Resend) improves speed and consistency, lifting both throughput and conversion potential.

## Limitations and Notes

1. This is a directional model for judging and planning, not audited finance.
2. Realization rates depend on user follow-through and payroll timelines.
3. For stricter ROI tracking, collect cohort-level data for submitted declarations, accepted deductions, and actual tax paid over time.
