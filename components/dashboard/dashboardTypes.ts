import { TestDefinition } from '../../types';

export interface TestStat {
  name: string;
  count: number;
  high: number;
  low: number;
  normal: number;
  total: number;
}

export interface DashboardStats {
  totalRecords: number;
  anomalyRate: number;
  totalAnomalies: number;
  topRisks: TestStat[];
  allTestStats: TestStat[];
  nightRestrictionCount: number;
  colorBlindCount: number;
  hearingLossCount: number;
}

export interface ChartPoint {
  id: string;
  name: string;
  val: number;
  job?: string;
}

export interface ChartData {
  definition: TestDefinition;
  values: ChartPoint[];
  minPlot: number;
  maxPlot: number;
  range: number;
}

export interface DepartmentStat {
  job: string;
  total: number;
  anomalyRate: number;
  topRisk: string;
}

export interface PatientScore {
  score: number;
  label: string;
  color: string;
  anomalies: number;
}
