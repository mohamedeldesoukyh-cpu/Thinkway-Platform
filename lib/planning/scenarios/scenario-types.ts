export type PlanningScenario = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

/** Reserved for multi-scenario forecasting (Sprint 3B+). */
export type ScenarioComparisonSlice = {
  scenario_id: string;
  scenario_code: string;
  revenue_delta: number;
  gp_delta: number;
};
