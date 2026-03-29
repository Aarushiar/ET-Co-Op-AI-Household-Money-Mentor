"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { SliderField } from "@/src/components/SliderField";
import { HouseholdFlowChart } from "@/src/components/HouseholdFlowChart";
import {
  BarChart3,
  Lock,
  LogOut,
  MailCheck,
  Moon,
  Plus,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import type {
  AiMentorResponse,
  EmailExecutionSummary,
  ExecuteFixesResponse,
  HouseholdOptimizationResult,
  LiquidityNeed,
  OptimizationRequest,
  RiskProfile,
  TaxRegime,
} from "@/src/types/tax";

type PartnerInputs = {
  salary: number;
  rent: number;
  sip: number;
  nps: number;
  insurance: number;
  assets: number;
  liabilities: number;
};

type PreferencesInputs = {
  riskProfile: RiskProfile;
  liquidityNeed: LiquidityNeed;
};

type LifeEventInputs = {
  id: string;
  name: string;
  yearsFromNow: number;
  oneTimeCost: number;
  monthlyImpact: number;
};

type DemoScenario = {
  id: string;
  label: string;
  description: string;
  partnerOne: PartnerInputs;
  partnerTwo: PartnerInputs;
  preferences: PreferencesInputs;
  lifeEvents: LifeEventInputs[];
};

let lifeEventSequence = 0;

function createLifeEvent(base: Omit<LifeEventInputs, "id">): LifeEventInputs {
  lifeEventSequence += 1;
  return {
    id: `life-event-${lifeEventSequence}`,
    ...base,
  };
}

function cloneLifeEvents(events: LifeEventInputs[]): LifeEventInputs[] {
  return events.map((event) =>
    createLifeEvent({
      name: event.name,
      yearsFromNow: event.yearsFromNow,
      oneTimeCost: event.oneTimeCost,
      monthlyImpact: event.monthlyImpact,
    }),
  );
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "dual-income-urban",
    label: "Urban DINK",
    description:
      "Balanced dual-income setup with moderate NPS and insurance coverage.",
    partnerOne: {
      salary: 1800000,
      rent: 300000,
      sip: 240000,
      nps: 20000,
      insurance: 12000,
      assets: 2200000,
      liabilities: 600000,
    },
    partnerTwo: {
      salary: 1200000,
      rent: 240000,
      sip: 180000,
      nps: 10000,
      insurance: 10000,
      assets: 1800000,
      liabilities: 450000,
    },
    preferences: { riskProfile: "moderate", liquidityNeed: "medium" },
    lifeEvents: [
      createLifeEvent({
        name: "Home Down Payment",
        yearsFromNow: 2,
        oneTimeCost: 1800000,
        monthlyImpact: 0,
      }),
      createLifeEvent({
        name: "Family Expansion",
        yearsFromNow: 3,
        oneTimeCost: 600000,
        monthlyImpact: 35000,
      }),
    ],
  },
  {
    id: "high-leakage",
    label: "High Leakage",
    description:
      "High income with low NPS/insurance usage to expose major deductible leakage.",
    partnerOne: {
      salary: 2800000,
      rent: 180000,
      sip: 70000,
      nps: 0,
      insurance: 5000,
      assets: 2500000,
      liabilities: 1800000,
    },
    partnerTwo: {
      salary: 2200000,
      rent: 150000,
      sip: 50000,
      nps: 0,
      insurance: 4000,
      assets: 1800000,
      liabilities: 1200000,
    },
    preferences: { riskProfile: "conservative", liquidityNeed: "high" },
    lifeEvents: [
      createLifeEvent({
        name: "Emergency Health Buffer",
        yearsFromNow: 1,
        oneTimeCost: 500000,
        monthlyImpact: 15000,
      }),
      createLifeEvent({
        name: "Vehicle Upgrade",
        yearsFromNow: 2,
        oneTimeCost: 1200000,
        monthlyImpact: 0,
      }),
    ],
  },
  {
    id: "aggressive-saving",
    label: "Aggressive Saver",
    description:
      "Strong SIP and NPS behavior with higher assets and moderate leverage.",
    partnerOne: {
      salary: 2400000,
      rent: 420000,
      sip: 360000,
      nps: 50000,
      insurance: 25000,
      assets: 4200000,
      liabilities: 900000,
    },
    partnerTwo: {
      salary: 1600000,
      rent: 300000,
      sip: 280000,
      nps: 45000,
      insurance: 22000,
      assets: 3100000,
      liabilities: 700000,
    },
    preferences: { riskProfile: "aggressive", liquidityNeed: "low" },
    lifeEvents: [
      createLifeEvent({
        name: "Global Education Fund",
        yearsFromNow: 8,
        oneTimeCost: 4500000,
        monthlyImpact: 0,
      }),
      createLifeEvent({
        name: "Sabbatical Year",
        yearsFromNow: 6,
        oneTimeCost: 1200000,
        monthlyImpact: 70000,
      }),
    ],
  },
];

const inrFormatter = new Intl.NumberFormat("en-IN");
const PLANNER_STATE_STORAGE_KEY = "et_coop_planner_state_v2";

type PersistedPlannerState = {
  partnerOne?: Partial<PartnerInputs>;
  partnerTwo?: Partial<PartnerInputs>;
  preferences?: Partial<PreferencesInputs>;
  lifeEvents?: Array<
    Pick<LifeEventInputs, "name" | "yearsFromNow" | "oneTimeCost" | "monthlyImpact">
  >;
  activeScenarioId?: string;
  result?: HouseholdOptimizationResult | null;
  aiMentorResult?: AiMentorResponse | null;
  emailExecution?: EmailExecutionSummary | null;
};

type AuthResponsePayload = {
  authenticated?: boolean;
  userEmail?: string | null;
  error?: string;
};

function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function hydratePartnerInputs(
  fallback: PartnerInputs,
  value?: Partial<PartnerInputs>,
): PartnerInputs {
  if (!value) {
    return fallback;
  }

  return {
    salary: toSafeNumber(value.salary, fallback.salary),
    rent: toSafeNumber(value.rent, fallback.rent),
    sip: toSafeNumber(value.sip, fallback.sip),
    nps: toSafeNumber(value.nps, fallback.nps),
    insurance: toSafeNumber(value.insurance, fallback.insurance),
    assets: toSafeNumber(value.assets, fallback.assets),
    liabilities: toSafeNumber(value.liabilities, fallback.liabilities),
  };
}

function hydratePreferences(
  fallback: PreferencesInputs,
  value?: Partial<PreferencesInputs>,
): PreferencesInputs {
  const riskProfile: RiskProfile =
    value?.riskProfile === "conservative" ||
    value?.riskProfile === "moderate" ||
    value?.riskProfile === "aggressive"
      ? value.riskProfile
      : fallback.riskProfile;

  const liquidityNeed: LiquidityNeed =
    value?.liquidityNeed === "high" ||
    value?.liquidityNeed === "medium" ||
    value?.liquidityNeed === "low"
      ? value.liquidityNeed
      : fallback.liquidityNeed;

  return {
    riskProfile,
    liquidityNeed,
  };
}

function hydrateLifeEvents(value?: PersistedPlannerState["lifeEvents"]): LifeEventInputs[] {
  if (!Array.isArray(value)) {
    return cloneLifeEvents(DEMO_SCENARIOS[0].lifeEvents);
  }

  const hydrated = value
    .slice(0, 12)
    .map((event) =>
      createLifeEvent({
        name: typeof event.name === "string" ? event.name.trim().slice(0, 80) : "",
        yearsFromNow: toSafeNumber(event.yearsFromNow, 1),
        oneTimeCost: toSafeNumber(event.oneTimeCost, 0),
        monthlyImpact: toSafeNumber(event.monthlyImpact, 0),
      }),
    )
    .filter((event) => event.name.length > 0);

  return hydrated.length ? hydrated : cloneLifeEvents(DEMO_SCENARIOS[0].lifeEvents);
}

function HouseholdCard({
  title,
  inputs,
  onChange,
}: {
  title: string;
  inputs: PartnerInputs;
  onChange: (next: PartnerInputs) => void;
}) {
  return (
    <section className="sota-card space-y-5 p-5 transition-colors dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <SliderField
        label="Annual Salary"
        value={inputs.salary}
        min={300000}
        max={6000000}
        step={10000}
        onChange={(value) => onChange({ ...inputs, salary: value })}
      />
      <SliderField
        label="Annual Rent Paid"
        value={inputs.rent}
        min={0}
        max={1200000}
        step={5000}
        onChange={(value) => onChange({ ...inputs, rent: value })}
      />
      <SliderField
        label="Annual SIP"
        value={inputs.sip}
        min={0}
        max={3000000}
        step={5000}
        onChange={(value) => onChange({ ...inputs, sip: value })}
      />
      <SliderField
        label="Annual NPS"
        value={inputs.nps}
        min={0}
        max={200000}
        step={1000}
        onChange={(value) => onChange({ ...inputs, nps: value })}
      />
      <SliderField
        label="Health Insurance Premium"
        value={inputs.insurance}
        min={0}
        max={120000}
        step={1000}
        onChange={(value) => onChange({ ...inputs, insurance: value })}
      />
      <SliderField
        label="Current Assets"
        value={inputs.assets}
        min={0}
        max={30000000}
        step={25000}
        onChange={(value) => onChange({ ...inputs, assets: value })}
      />
      <SliderField
        label="Current Liabilities"
        value={inputs.liabilities}
        min={0}
        max={20000000}
        step={25000}
        onChange={(value) => onChange({ ...inputs, liabilities: value })}
      />
    </section>
  );
}

function regimeLabel(regime: TaxRegime): string {
  return regime === "old" ? "Old Regime" : "New Regime";
}

function ResultMetric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "danger"
        ? "text-rose-700 bg-rose-50 border-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        : "text-slate-800 bg-slate-50 border-slate-200 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200";

  return (
    <div className={`sota-metric ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em]">{label}</p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

const cardReveal = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [partnerOne, setPartnerOne] = useState<PartnerInputs>({
    salary: 1800000,
    rent: 300000,
    sip: 240000,
    nps: 20000,
    insurance: 12000,
    assets: 2200000,
    liabilities: 600000,
  });
  const [partnerTwo, setPartnerTwo] = useState<PartnerInputs>({
    salary: 1200000,
    rent: 240000,
    sip: 180000,
    nps: 10000,
    insurance: 10000,
    assets: 1800000,
    liabilities: 450000,
  });
  const [preferences, setPreferences] = useState<PreferencesInputs>({
    riskProfile: "moderate",
    liquidityNeed: "medium",
  });
  const [lifeEvents, setLifeEvents] = useState<LifeEventInputs[]>(() =>
    cloneLifeEvents(DEMO_SCENARIOS[0].lifeEvents),
  );
  const [result, setResult] = useState<HouseholdOptimizationResult | null>(null);
  const [aiMentorResult, setAiMentorResult] = useState<AiMentorResponse | null>(null);
  const [emailExecution, setEmailExecution] = useState<EmailExecutionSummary | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isExecutingFixes, setIsExecutingFixes] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    DEMO_SCENARIOS[0].id,
  );

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json()) as AuthResponsePayload;
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
          setCurrentUserEmail(data.userEmail ?? null);
        }
      } catch {
        if (active) {
          setIsAuthenticated(false);
          setCurrentUserEmail(null);
        }
      } finally {
        if (active) {
          setIsAuthLoading(false);
        }
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(PLANNER_STATE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedPlannerState;
      setPartnerOne((prev) => hydratePartnerInputs(prev, parsed.partnerOne));
      setPartnerTwo((prev) => hydratePartnerInputs(prev, parsed.partnerTwo));
      setPreferences((prev) => hydratePreferences(prev, parsed.preferences));

      if (parsed.lifeEvents) {
        setLifeEvents(hydrateLifeEvents(parsed.lifeEvents));
      }

      if (parsed.activeScenarioId && typeof parsed.activeScenarioId === "string") {
        setActiveScenarioId(parsed.activeScenarioId);

        if (!parsed.lifeEvents) {
          const scenario = DEMO_SCENARIOS.find(
            (item) => item.id === parsed.activeScenarioId,
          );
          if (scenario) {
            setLifeEvents(cloneLifeEvents(scenario.lifeEvents));
          }
        }
      }

      if (parsed.result) {
        setResult(parsed.result);
      }

      if (parsed.aiMentorResult) {
        setAiMentorResult(parsed.aiMentorResult);
      }

      if (parsed.emailExecution) {
        setEmailExecution(parsed.emailExecution);
      }
    } catch {
      // Ignore corrupted local state and continue with defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextState: PersistedPlannerState = {
      partnerOne,
      partnerTwo,
      preferences,
      lifeEvents: lifeEvents.map((event) => ({
        name: event.name,
        yearsFromNow: event.yearsFromNow,
        oneTimeCost: event.oneTimeCost,
        monthlyImpact: event.monthlyImpact,
      })),
      activeScenarioId,
      result,
      aiMentorResult,
      emailExecution,
    };

    window.localStorage.setItem(
      PLANNER_STATE_STORAGE_KEY,
      JSON.stringify(nextState),
    );
  }, [
    activeScenarioId,
    aiMentorResult,
    emailExecution,
    lifeEvents,
    partnerOne,
    partnerTwo,
    preferences,
    result,
  ]);

  const totals = useMemo(() => {
    const totalIncome = partnerOne.salary + partnerTwo.salary;
    const totalRent = partnerOne.rent + partnerTwo.rent;
    const totalSip = partnerOne.sip + partnerTwo.sip;
    const totalNps = partnerOne.nps + partnerTwo.nps;
    const totalInsurance = partnerOne.insurance + partnerTwo.insurance;
    const totalAssets = partnerOne.assets + partnerTwo.assets;
    const totalLiabilities = partnerOne.liabilities + partnerTwo.liabilities;
    const totalNetWorth = Math.max(0, totalAssets - totalLiabilities);

    return {
      totalIncome,
      totalRent,
      totalSip,
      totalNps,
      totalInsurance,
      totalAssets,
      totalLiabilities,
      totalNetWorth,
    };
  }, [partnerOne, partnerTwo]);

  const activeScenario =
    DEMO_SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ??
    DEMO_SCENARIOS[0];

  const fireProjection = result?.advancedModules?.fireProjection;
  const healthScore = result?.advancedModules?.healthScore;
  const lifeEventSimulator = result?.advancedModules?.lifeEventSimulator ?? [];
  const mutualFundXRay = result?.advancedModules?.mutualFundXRay;

  function clearExecutionState() {
    setResult(null);
    setAiMentorResult(null);
    setEmailExecution(null);
    setErrorMessage(null);
    setAiErrorMessage(null);
    setExecutionError(null);
  }

  function applyScenario(scenarioId: string) {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === scenarioId);
    if (!scenario) {
      return;
    }

    setPartnerOne({ ...scenario.partnerOne });
    setPartnerTwo({ ...scenario.partnerTwo });
    setPreferences({ ...scenario.preferences });
    setLifeEvents(cloneLifeEvents(scenario.lifeEvents));
    setActiveScenarioId(scenario.id);
    clearExecutionState();
  }

  function onPartnerOneChange(next: PartnerInputs) {
    setPartnerOne(next);
    clearExecutionState();
  }

  function onPartnerTwoChange(next: PartnerInputs) {
    setPartnerTwo(next);
    clearExecutionState();
  }

  function addLifeEvent() {
    setLifeEvents((prev) => {
      if (prev.length >= 12) {
        return prev;
      }

      return [
        ...prev,
        createLifeEvent({
          name: `Life Event ${prev.length + 1}`,
          yearsFromNow: 1,
          oneTimeCost: 0,
          monthlyImpact: 0,
        }),
      ];
    });
    clearExecutionState();
  }

  function updateLifeEvent(
    id: string,
    updates: Partial<Omit<LifeEventInputs, "id">>,
  ) {
    setLifeEvents((prev) =>
      prev.map((event) => (event.id === id ? { ...event, ...updates } : event)),
    );
    clearExecutionState();
  }

  function removeLifeEvent(id: string) {
    setLifeEvents((prev) => {
      const remaining = prev.filter((event) => event.id !== id);
      return remaining.length ? remaining : prev;
    });
    clearExecutionState();
  }

  function buildOptimizationRequest(): OptimizationRequest {
    return {
      partners: [
        {
          name: "Partner A",
          annualSalary: partnerOne.salary,
          annualRentPaid: partnerOne.rent,
          annualSipInvestment: partnerOne.sip,
          annualNpsContribution: partnerOne.nps,
          annualHealthInsurancePremium: partnerOne.insurance,
          currentAssets: partnerOne.assets,
          currentLiabilities: partnerOne.liabilities,
          isMetroCity: true,
        },
        {
          name: "Partner B",
          annualSalary: partnerTwo.salary,
          annualRentPaid: partnerTwo.rent,
          annualSipInvestment: partnerTwo.sip,
          annualNpsContribution: partnerTwo.nps,
          annualHealthInsurancePremium: partnerTwo.insurance,
          currentAssets: partnerTwo.assets,
          currentLiabilities: partnerTwo.liabilities,
          isMetroCity: true,
        },
      ],
      preferences: {
        riskProfile: preferences.riskProfile,
        liquidityNeed: preferences.liquidityNeed,
      },
      lifeEvents: lifeEvents
        .map((event) => ({
          name: event.name.trim(),
          yearsFromNow: toSafeNumber(event.yearsFromNow, 0),
          oneTimeCost: toSafeNumber(event.oneTimeCost, 0),
          monthlyImpact: toSafeNumber(event.monthlyImpact, 0),
        }))
        .filter((event) => event.name.length > 0)
        .slice(0, 12),
    };
  }

  async function login() {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthErrorMessage("Enter your email and password.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = (await response.json()) as AuthResponsePayload;
      if (!response.ok) {
        throw new Error(data.error ?? "Login failed");
      }

      setIsAuthenticated(true);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthErrorMessage(null);
      setCurrentUserEmail(data.userEmail ?? authEmail.toLowerCase());
    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setAuthErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in right now.",
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function register() {
    if (!authEmail.trim() || !authPassword.trim() || !authConfirmPassword.trim()) {
      setAuthErrorMessage("Enter email, password, and confirm password.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthErrorMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          confirmPassword: authConfirmPassword,
        }),
      });

      const data = (await response.json()) as AuthResponsePayload;
      if (!response.ok) {
        throw new Error(data.error ?? "Registration failed");
      }

      setIsAuthenticated(true);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthErrorMessage(null);
      setCurrentUserEmail(data.userEmail ?? authEmail.toLowerCase());
    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setAuthErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to register right now.",
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setAuthErrorMessage(null);
      clearExecutionState();
    }
  }

  function handleUnauthorized(data: { error?: string }): void {
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
    setAuthErrorMessage(
      data.error ?? "Session expired. Please log in again.",
    );
  }

  async function submitAuth() {
    if (authMode === "signin") {
      await login();
      return;
    }

    await register();
  }

  async function runOptimization() {
    setIsRunning(true);
    clearExecutionState();

    try {
      const payload: OptimizationRequest = buildOptimizationRequest();

      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | HouseholdOptimizationResult
        | { error?: string };

      if (response.status === 401) {
        handleUnauthorized(data as { error?: string });
        return;
      }

      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error : "Request failed");
      }

      setResult(data as HouseholdOptimizationResult);
    } catch (error) {
      setResult(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to run optimization right now.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  async function generateAiMentorOutput() {
    if (!result) {
      return;
    }

    setIsGeneratingAi(true);
    setAiErrorMessage(null);

    try {
      const response = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optimizationRequest: buildOptimizationRequest() }),
      });

      const data = (await response.json()) as
        | AiMentorResponse
        | { error?: string };

      if (response.status === 401) {
        handleUnauthorized(data as { error?: string });
        return;
      }

      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error : "Request failed");
      }

      setAiMentorResult(data as AiMentorResponse);
      setEmailExecution(null);
    } catch (error) {
      setAiMentorResult(null);
      setAiErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate AI mentor guidance right now.",
      );
    } finally {
      setIsGeneratingAi(false);
    }
  }

  async function executeFixes() {
    if (!result) {
      return;
    }

    setIsExecutingFixes(true);
    setExecutionError(null);

    try {
      const response = await fetch("/api/execute-fixes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optimizationRequest: buildOptimizationRequest() }),
      });

      const data = (await response.json()) as ExecuteFixesResponse | { error?: string };

      if (response.status === 401) {
        handleUnauthorized(data as { error?: string });
        return;
      }

      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error : "Request failed");
      }

      const payload = data as ExecuteFixesResponse;
      setAiMentorResult(payload.aiMentor);
      setEmailExecution(payload.emailExecution);
    } catch (error) {
      setExecutionError(
        error instanceof Error
          ? error.message
          : "Unable to execute fixes right now.",
      );
    } finally {
      setIsExecutingFixes(false);
    }
  }

  return (
    <div className="sota-shell">
      <motion.main
        initial="initial"
        animate="animate"
        className="space-y-6"
      >
        <motion.header
          variants={cardReveal}
          className="sota-card sota-card-elevated overflow-hidden p-6 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="sota-pill">ET Co-Op AI Mentor</span>
              <span className="sota-pill">Prototype v1</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAuthenticated ? (
                <>
                  {currentUserEmail ? <span className="sota-pill">{currentUserEmail}</span> : null}
                  <button
                    type="button"
                    onClick={logout}
                    className="sota-focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </>
              ) : (
                <span className="sota-pill">
                  <Lock size={12} />
                  Account Access
                </span>
              )}

              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="sota-focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {isThemeReady && theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                {isThemeReady && theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>
          <div className="mt-4 max-w-3xl">
            <h1 className="font-[var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              Couple&apos;s Tax Planner, Styled For Decision Speed
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Notion-like input simplicity with Stripe-style financial intelligence.
              Add household numbers and get tax leakage, regime recommendation,
              and immediate next moves.
            </p>
          </div>
        </motion.header>

        {isAuthLoading ? (
          <section className="sota-card p-6 sm:p-7">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Checking secure session...
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Preparing your protected planner workspace.
            </p>
          </section>
        ) : !isAuthenticated ? (
          <section className="sota-card p-6 sm:p-7">
            <h2 className="font-[var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">
              {authMode === "signin" ? "Sign In" : "Create Account"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Register once, then sign in with your email and password to access your planner.
            </p>

            <div className="mt-4 max-w-md space-y-3">
              <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthErrorMessage(null);
                  }}
                  className={`sota-focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    authMode === "signin"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthErrorMessage(null);
                  }}
                  className={`sota-focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    authMode === "register"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                  }`}
                >
                  Register
                </button>
              </div>

              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitAuth();
                  }
                }}
                placeholder="Email"
                className="sota-focus-ring w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />

              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitAuth();
                  }
                }}
                placeholder="Password"
                className="sota-focus-ring w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />

              {authMode === "register" ? (
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={(event) => setAuthConfirmPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void submitAuth();
                    }
                  }}
                  placeholder="Confirm password"
                  className="sota-focus-ring w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void submitAuth();
                }}
                disabled={isAuthSubmitting}
                className="sota-focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAuthSubmitting
                  ? authMode === "signin"
                    ? "Signing in..."
                    : "Creating account..."
                  : authMode === "signin"
                    ? "Sign in to Continue"
                    : "Create Account"}
              </button>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Password must be at least 8 characters.
              </p>

              {authErrorMessage ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {authErrorMessage}
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.02fr_1fr]">
          <motion.section variants={cardReveal} className="sota-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[var(--font-space-grotesk)] text-lg font-bold text-slate-900 dark:text-slate-100">
                Input Workspace
              </h2>
              <span className="sota-pill">Guided 2-person setup</span>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                Quick Demo Presets
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMO_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => applyScenario(scenario.id)}
                    className={`sota-focus-ring rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                      activeScenarioId === scenario.id
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {activeScenario.description}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                  Risk Profile
                  <select
                    value={preferences.riskProfile}
                    onChange={(event) => {
                      setPreferences((prev) => ({
                        ...prev,
                        riskProfile: event.target.value as RiskProfile,
                      }));
                      clearExecutionState();
                    }}
                    className="sota-focus-ring mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                  Liquidity Need
                  <select
                    value={preferences.liquidityNeed}
                    onChange={(event) => {
                      setPreferences((prev) => ({
                        ...prev,
                        liquidityNeed: event.target.value as LiquidityNeed,
                      }));
                      clearExecutionState();
                    }}
                    className="sota-focus-ring mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>

              <HouseholdCard
                title="Partner A"
                inputs={partnerOne}
                onChange={onPartnerOneChange}
              />
              <HouseholdCard
                title="Partner B"
                inputs={partnerTwo}
                onChange={onPartnerTwoChange}
              />

              <div className="sota-card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Life Event Inputs
                  </p>
                  <button
                    type="button"
                    onClick={addLifeEvent}
                    disabled={lifeEvents.length >= 12}
                    className="sota-focus-ring inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Plus size={12} />
                    Add Event
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Add up to 12 custom events. These drive the Life Event Simulator and FIRE gap projections.
                </p>

                <div className="space-y-2">
                  {lifeEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Event Name
                          <input
                            type="text"
                            value={event.name}
                            maxLength={80}
                            onChange={(next) =>
                              updateLifeEvent(event.id, { name: next.target.value })
                            }
                            className="sota-focus-ring mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>

                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Years From Now
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={event.yearsFromNow}
                            onChange={(next) =>
                              updateLifeEvent(event.id, {
                                yearsFromNow: Math.min(40, toSafeNumber(Number(next.target.value), 0)),
                              })
                            }
                            className="sota-focus-ring mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>

                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          One-Time Cost (Rs)
                          <input
                            type="number"
                            min={0}
                            step={5000}
                            value={event.oneTimeCost}
                            onChange={(next) =>
                              updateLifeEvent(event.id, {
                                oneTimeCost: toSafeNumber(Number(next.target.value), 0),
                              })
                            }
                            className="sota-focus-ring mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>

                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Monthly Impact (Rs)
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={event.monthlyImpact}
                            onChange={(next) =>
                              updateLifeEvent(event.id, {
                                monthlyImpact: toSafeNumber(Number(next.target.value), 0),
                              })
                            }
                            className="sota-focus-ring mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLifeEvent(event.id)}
                          disabled={lifeEvents.length <= 1}
                          className="sota-focus-ring inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Household Income
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalIncome)}
                </p>
              </div>
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Annual Rent
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalRent)}
                </p>
              </div>
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Annual SIP
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalSip)}
                </p>
              </div>
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Annual NPS
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalNps)}
                </p>
              </div>
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Insurance Premium
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalInsurance)}
                </p>
              </div>
              <div className="sota-metric">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Net Worth Snapshot
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Rs {inrFormatter.format(totals.totalNetWorth)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runOptimization}
              disabled={isRunning}
              className="sota-focus-ring mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl border border-blue-700 bg-gradient-to-r from-blue-700 to-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)] transition hover:from-blue-600 hover:to-blue-500 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
            >
              {isRunning ? "Running Optimization..." : "Run Household Optimization"}
            </button>

            {errorMessage ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errorMessage}
              </p>
            ) : null}
          </motion.section>

          <motion.section variants={cardReveal} className="sota-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[var(--font-space-grotesk)] text-lg font-bold text-slate-900 dark:text-slate-100">
                Live Decision Board
              </h2>
              <span className="sota-pill">Stripe-style summary</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Results appear here instantly after optimization.
            </p>

            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-5 space-y-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ResultMetric
                      label="Tax Leakage"
                      value={`Rs ${inrFormatter.format(result.household.leakageDetected)}`}
                      tone="danger"
                      icon={<TrendingDown size={15} />}
                    />
                    <ResultMetric
                      label="Current Tax"
                      value={`Rs ${inrFormatter.format(result.household.totalCurrentBestTax)}`}
                      tone="neutral"
                      icon={<Wallet size={15} />}
                    />
                    <ResultMetric
                      label="Optimized Tax"
                      value={`Rs ${inrFormatter.format(result.household.totalOptimizedBestTax)}`}
                      tone="success"
                      icon={<TrendingUp size={15} />}
                    />
                    <ResultMetric
                      label="Net Worth"
                      value={`Rs ${inrFormatter.format(result.household.totalNetWorth)}`}
                      tone="neutral"
                      icon={<BarChart3 size={15} />}
                    />
                  </div>

                  <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                      Regime Comparison + Household Allocation
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                      <p>
                        Old Regime (Current): Rs{" "}
                        {inrFormatter.format(result.household.oldRegimeCombinedTaxCurrent)}
                      </p>
                      <p>
                        Old Regime (Optimized): Rs{" "}
                        {inrFormatter.format(result.household.oldRegimeCombinedTaxOptimized)}
                      </p>
                      <p>
                        New Regime: Rs {inrFormatter.format(result.household.newRegimeCombinedTax)}
                      </p>
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        Recommended: {regimeLabel(result.household.recommendedOptimizedRegime)}
                      </p>
                      <p>
                        Total NPS: Rs {inrFormatter.format(result.household.totalNps)}
                      </p>
                      <p>
                        Total Insurance: Rs{" "}
                        {inrFormatter.format(result.household.totalInsurancePremium)}
                      </p>
                      <p>
                        Total Assets: Rs {inrFormatter.format(result.household.totalAssets)}
                      </p>
                      <p>
                        Total Liabilities: Rs{" "}
                        {inrFormatter.format(result.household.totalLiabilities)}
                      </p>
                    </div>
                  </div>

                  <HouseholdFlowChart result={result} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    {result.partnerResults.map((partnerResult) => (
                      <div
                        key={partnerResult.partnerName}
                        className="sota-card border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <h3 className="font-[var(--font-space-grotesk)] text-sm font-bold text-slate-900 dark:text-slate-100">
                          {partnerResult.partnerName}
                        </h3>
                        <div className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                          <p>
                            Old Regime Tax: Rs{" "}
                            {inrFormatter.format(partnerResult.oldRegimeTaxOptimized)}
                          </p>
                          <p>
                            New Regime Tax: Rs {inrFormatter.format(partnerResult.newRegimeTax)}
                          </p>
                          <p className="font-semibold text-rose-700">
                            Leakage: Rs {inrFormatter.format(partnerResult.leakageAmount)}
                          </p>
                          <p>
                            NPS Benefit Potential: Rs{" "}
                            {inrFormatter.format(partnerResult.npsTaxBenefitPotential)}
                          </p>
                          <p>
                            80C Used: Rs {inrFormatter.format(partnerResult.deductions.section80CCurrent)}
                          </p>
                          <p>
                            80D Used: Rs {inrFormatter.format(partnerResult.deductions.section80DCurrent)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <Target size={15} className="text-blue-600" />
                      Couple Optimization Insights
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      {result.coupleOptimizationInsights.map((insight) => (
                        <li key={insight}>{insight}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <Shield size={15} className="text-blue-600" />
                      Ranked Tax-Saving Investments
                    </p>
                    <div className="mt-3 space-y-2">
                      {result.rankedTaxSavingInvestments.length ? (
                        result.rankedTaxSavingInvestments.map((item) => (
                          <div
                            key={`${item.name}-${item.applicableSection}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {item.name}
                              </p>
                              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300">
                                Priority {item.priorityScore}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              Section {item.applicableSection} | Risk: {item.risk} |
                              Liquidity: {item.liquidity}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              Annual Allocation: Rs {inrFormatter.format(item.recommendedAnnualAmount)}
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                              {item.rationale}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          No immediate tax-saving allocation gaps detected.
                        </p>
                      )}
                    </div>
                  </div>

                  {fireProjection ? (
                    <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Target size={15} className="text-blue-600" />
                        FIRE Readiness Projection
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                        <p>
                          Annual Expense Estimate: Rs {inrFormatter.format(fireProjection.annualExpenseEstimate)}
                        </p>
                        <p>
                          Current Net Worth: Rs {inrFormatter.format(fireProjection.currentNetWorth)}
                        </p>
                        <p>
                          Target Corpus: Rs {inrFormatter.format(fireProjection.targetCorpus)}
                        </p>
                        <p>
                          Gap to FIRE: Rs {inrFormatter.format(fireProjection.gapToFire)}
                        </p>
                        <p>
                          Annual Investible Surplus: Rs {inrFormatter.format(fireProjection.annualInvestibleSurplus)}
                        </p>
                        <p>
                          Estimated Years: {fireProjection.estimatedYearsToFire >= 40 ? "40+" : fireProjection.estimatedYearsToFire}
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Assumed annual return: {(fireProjection.assumedAnnualReturnRate * 100).toFixed(0)}%
                      </p>
                    </div>
                  ) : null}

                  {healthScore ? (
                    <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <BarChart3 size={15} className="text-blue-600" />
                          Financial Health Score
                        </p>
                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300">
                          {healthScore.score}/100 - {healthScore.band}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                        <p>Tax Efficiency: {healthScore.breakdown.taxEfficiency}</p>
                        <p>Protection: {healthScore.breakdown.protection}</p>
                        <p>Leverage: {healthScore.breakdown.leverage}</p>
                        <p>Savings Discipline: {healthScore.breakdown.savingsDiscipline}</p>
                      </div>
                    </div>
                  ) : null}

                  {lifeEventSimulator.length ? (
                    <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Sparkles size={15} className="text-blue-600" />
                        Life Event Simulator
                      </p>
                      <div className="mt-3 space-y-2">
                        {lifeEventSimulator.map((event) => (
                          <div
                            key={event.name}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                          >
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {event.name} ({event.yearsFromNow}y)
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              One-time: Rs {inrFormatter.format(event.oneTimeCost)} | Monthly: Rs {inrFormatter.format(event.monthlyImpact)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                              Projected additional need: Rs {inrFormatter.format(event.projectedAdditionalNeed)}
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{event.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {mutualFundXRay ? (
                    <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Shield size={15} className="text-blue-600" />
                        Mutual Fund X-Ray
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                        <p>SIP to income ratio: {mutualFundXRay.sipToIncomeRatio}%</p>
                        <p>Equity tilt: {mutualFundXRay.equityTilt}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        {mutualFundXRay.taxSaverAllocationHint}
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {mutualFundXRay.rebalancingAction}
                      </p>
                    </div>
                  ) : null}

                  <div className="sota-card border border-slate-200 p-4 dark:border-slate-700">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <Sparkles size={15} className="text-blue-600" />
                      Optimization Suggestions
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      {result.optimizationSuggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="sota-card border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MailCheck size={15} className="text-blue-600" />
                        AI Mentor Layer
                      </p>
                      {aiMentorResult ? (
                        <span className="sota-pill">
                          Generated via {aiMentorResult.generatedBy.toUpperCase()}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={generateAiMentorOutput}
                      disabled={isGeneratingAi || isExecutingFixes}
                      className="sota-focus-ring mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingAi
                        ? "Generating AI Guidance..."
                        : "Generate AI Explanation + HR Email Drafts"}
                    </button>

                    <button
                      type="button"
                      onClick={executeFixes}
                      disabled={isExecutingFixes || isGeneratingAi}
                      className="sota-focus-ring mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isExecutingFixes
                        ? "Executing Fixes..."
                        : "Execute Fixes (Generate + Send Emails)"}
                    </button>

                    {aiErrorMessage ? (
                      <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {aiErrorMessage}
                      </p>
                    ) : null}

                    {executionError ? (
                      <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {executionError}
                      </p>
                    ) : null}

                    {emailExecution ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                          Email Execution Status
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {emailExecution.summary}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Mode: {emailExecution.mode} | Provider: {emailExecution.provider}
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {emailExecution.results.map((entry) => (
                            <div
                              key={`${entry.partnerName}-${entry.to ?? "none"}`}
                              className="rounded-md border border-slate-200 bg-white p-2"
                            >
                              <p className="text-sm font-semibold text-slate-800">
                                {entry.partnerName}
                              </p>
                              <p className="text-xs text-slate-600">
                                To: {entry.to ?? "Not configured"}
                              </p>
                              <p className="text-xs font-semibold text-slate-700">
                                Status: {entry.status.toUpperCase()}
                              </p>
                              {entry.error ? (
                                <p className="mt-1 text-xs text-rose-700">{entry.error}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {aiMentorResult ? (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                            Human-readable Summary
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-800">
                            {aiMentorResult.plainEnglishSummary}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {aiMentorResult.householdNarrative}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                            AI Key Moves
                          </p>
                          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                            {aiMentorResult.keyMoves.map((move) => (
                              <li key={move}>{move}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {aiMentorResult.hrEmailDrafts.map((draft) => (
                            <div
                              key={draft.partnerName}
                              className="rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                                HR Draft - {draft.partnerName}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                Subject: {draft.subject}
                              </p>
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                                {draft.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25 }}
                  className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    Your dashboard will appear here
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Click Run Household Optimization to generate tax leakage analysis,
                    regime comparison, and action-ready suggestions.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
          </section>
        )}
      </motion.main>
    </div>
  );
}
