export interface SimulationParams {
  NUM_MEMBERS: number;
  SIMULATION_WEEKS: number;
  INITIAL_WEALTH_MEAN_LOG: number;
  INITIAL_WEALTH_SIGMA_LOG: number;
  WEEKLY_FOOD_BUDGET_AVG: number;
  WEEKLY_FOOD_BUDGET_STDDEV: number;
  MIN_WEEKLY_BUDGET: number;
  WEEKLY_INCOME_AVG: number;
  WEEKLY_INCOME_STDDEV: number;
  MIN_WEEKLY_INCOME: number;
  GROUP_BUY_SAVINGS_PERCENT: number;
  LOCAL_PRODUCTION_SAVINGS_PERCENT: number;
  PERCENT_SPEND_INTERNAL_AVG: number;
  PERCENT_SPEND_INTERNAL_STDDEV: number;
  GROTOKEN_REWARD_PER_WEEK_AVG: number;
  GROTOKEN_REWARD_STDDEV: number;
  GROTOKEN_USD_VALUE: number;
  WEEKLY_COOP_FEE_B: number;
  localEconomicActivities?: LocalEconomicActivity[]; // Explicitly defined
  [key: string]: number | LocalEconomicActivity[] | undefined; // Allow string keys to be number, LocalEconomicActivity[] or undefined
}

export interface SimMember {
  id: string;
  wealth_scenario_A: number;
  wealth_scenario_B: number;
  food_usd_balance: number;
  grotoken_balance: number;
  weekly_food_budget: number;
  propensity_to_spend_internal: number;
  weekly_income: number;
  internal_transaction_count: number;
  grotoken_usage_rate: number;
}

export interface WeeklyMetrics {
  Week: number;
  Year: number;
  Quarter: number;
  AvgWealth_A: number;
  AvgWealth_B: number;
  MedianWealth_A: number;
  MedianWealth_B: number;
  TotalWealth_A: number;
  TotalWealth_B: number;
  WealthQuintiles_A: number[];
  WealthQuintiles_B: number[];
  Top10Percent_A: number;
  Top10Percent_B: number;
  Bottom10Percent_A: number;
  Bottom10Percent_B: number;
  Gini_A: number;
  Gini_B: number;
  WealthGap_A: number;
  WealthGap_B: number;
  Bottom20PctShare: number;
  PovertyRate_A: number;
  PovertyRate_B: number;
  WealthMobility: number;
  LocalEconomyStrength: number;
  CommunityResilience: number;
  EconomicVelocity: number;
  SocialSafetyNet: number;
  InnovationIndex: number;
  SustainabilityScore: number;
  CommunityEngagement: number;
  [key: string]: number | number[];
}

export interface KeyEvent {
  week: number;
  type: string;
  description: string;
}

export interface NarrativeSummary {
  title: string;
  overview: string;
  key_findings: {
    wealth_impact: {
      summary: string;
      details: string;
    };
    equality_measures: {
      summary: string;
      gini: string;
      details: string;
    };
    community_health: {
      poverty: string;
      resilience: string;
      details: string;
      sustainability: string;
    };
  };
  phase_analysis: Array<{
    period: string;
    type: string;
    characteristics: string;
    metrics: {
      avg_wealth: string;
      poverty_rate: string;
      gini: string;
    };
  }>;
  key_events: string[];
  conclusion: string;
}

export interface SimulationResults {
  history: WeeklyMetrics[];
  final_members: SimMember[];
  key_events: KeyEvent[];
  summary: NarrativeSummary;
  params: SimulationParams; // Include the parameters used for the simulation
}

export interface EconomicMetricsClass {
  members: SimMember[];
  params: SimulationParams;
  previous_metrics: WeeklyMetrics | null;
  current_week: number;
  calculate_metrics: (wealth_A_list: number[], wealth_B_list: number[], week: number) => WeeklyMetrics;
  calculate_poverty_rate: (wealth_list: number[]) => number;
  calculate_wealth_mobility: () => number;
  calculate_local_economy_strength: () => number;
  calculate_community_resilience: () => number;
  calculate_wealth_gap: (wealth_list: number[]) => number;
  calculate_bottom_20_pct_share: (wealth_list: number[]) => number;
  calculate_economic_velocity: () => number;
  calculate_social_safety_net: () => number;
  calculate_innovation_index: () => number;
  calculate_sustainability_score: () => number;
  calculate_community_engagement: () => number;
  calculate_market_efficiency: () => number;
  calculate_innovation_adoption: () => number;
  calculate_wealth_mobility_score: () => number;
  calculate_economic_diversity: () => number;
  calculate_risk_resilience: () => number;
  calculate_trends: (current_metrics: WeeklyMetrics) => Record<string, number>;
  calculate_advanced_metrics: () => Record<string, number>;
}

export interface LocalEconomicActivity {
  id: string;
  name: string;
  type: string; // e.g., 'kombucha_production', 'group_buy'
  startWeek: number;
  endWeek?: number; // Optional end week for recurring activities
  schedule: 'once' | 'weekly' | 'monthly';
  params: any; // Specific parameters for the activity type
  recentFinancialResults?: any; // To store results for narrative or dashboard
  participants: string[]; // Array of member IDs
}
