export interface OverviewMetrics {
  assets_created_week: number;
  assets_created_month: number;
  total_remixes: number;
  compliance_rate: number;
  active_fscs: number;
}

export interface TopRemixedItem {
  item_id: string;
  artifact_name: string;
  artifact_type: string;
  product: string | null;
  remix_count: number;
}

export interface TopRemixedResponse {
  items: TopRemixedItem[];
}

export interface ContentGap {
  product: string | null;
  artifact_type: string;
  fsc_count: number;
}

export interface ContentGapResponse {
  gaps: ContentGap[];
}

export interface ActivityDataPoint {
  date: string;
  created: number;
  exported: number;
}

export interface ActivityResponse {
  data: ActivityDataPoint[];
  granularity: string;
}
