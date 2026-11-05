// All tunable app constants live here.
export const APP = {
  NAME: "Kharcha",
  TAGLINE: "Your khata, simplified",
  CURRENCY_LABEL: "Rs",
  /** Short word for "the people you share bills with" in the one-line summary under the Home amount. */
  FRIENDS_LABEL: "homies",
  LOCALE: "en-PK",
  WEEK_STARTS_ON: 1, // 0 = Sunday, 1 = Monday
  DEFAULT_SPLIT_PERCENT: 50,
  DEFAULT_REIMBURSABLE_FROM: "Company",
  SPLASH_MIN_MS: 900,
  ASK_FUNCTION: "ask-grok",
  ASK_MAX_CHARS: 500,
  ASK_SUGGESTIONS: [
    "How much did I spend on food this month?",
    "How much does my roommate owe me right now?",
    "Who still hasn't returned my money?",
    "Which company expenses are not reimbursed yet?",
    "Compare my spending this month vs last month",
  ],
  CHART_TOP_N: 5, // categories drawn in colour; the rest are grouped as "Other"
} as const;

export const DEFAULT_TARGET_NAME = "Myself"; // expenses with no "spent for" tag count as this

// Icons for categories created by the Monefy import (matched by lowercase name; anything else gets "tag").
export const IMPORT_ICON_HINTS: Record<string, string> = {
  food: "food", "eating out": "coffee", taxi: "car", car: "car", transport: "bus", clothes: "bag", shopping: "bag",
  gifts: "gift", house: "home", home: "home", rent: "home", communications: "phone", bills: "bills",
  health: "heart", entertainment: "play", groceries: "cart", sports: "play", toiletry: "tag",
};

export const SPLIT_LABELS = {
  personal: "Personal",
  split: "Split",
  owed_by_friend: "Friend owes all",
  reimbursable: "Company claim",
} as const;

// Warm chart palette (same in light and dark). Ranked colours: biggest category first.
export const CHART_COLORS = ["#b4472a", "#d9a066", "#8a9a5b", "#6b7f8c", "#a8764b"];
export const OTHER_COLOR = "#b9ad9c";

export type ChartView = "receipt" | "bubbles" | "gauge" | "ring" | "bar";
export const CHART_VIEWS: { id: ChartView; label: string; icon: string }[] = [
  { id: "receipt", label: "Receipt", icon: "receipt" },
  { id: "bubbles", label: "Bubbles", icon: "bubbles" },
  { id: "gauge", label: "Gauge", icon: "gauge" },
  { id: "ring", label: "Ring", icon: "ring" },
  { id: "bar", label: "Bar", icon: "bars" },
];
export const DEFAULT_CHART_VIEW: ChartView = "gauge";
