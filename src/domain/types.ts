export type AnalysisMode = "detail";
export type Handedness = "right" | "left";
export type ThrowIndex = 0 | 1 | 2;
export type BodyPart = "wrist" | "elbow" | "shoulderArm" | "release";

export type ThrowWindow = {
  startMillis: number | null;
  endMillis: number | null;
  releaseMillis: number | null;
  releasePoint: { x: number; y: number };
  impactPoint: { x: number; y: number } | null;
};

export type SessionConfig = {
  targetLabel: TargetLabel | null;
  measureGrouping: boolean;
  measureRelease: boolean;
  measureAim: boolean;
};

// Normalized coordinates in the range [0, 1].
export type Point = {
  x: number;
  y: number;
};

export type TargetLabel = "bull" | "20" | "19" | "18" | "17" | "16" | "15";

export type DetailInputState = {
  boardHits: Point[];
  releasePoints: Point[];
  elbowPoints: Array<Point | null>;     // 3投分、未記録はnull
  wristPoints?: Array<Point | null>;    // 3投分、未記録はnull（v1.1）
  shoulderPoints?: Array<Point | null>; // 3投分、未記録はnull（v1.1 3点計測）
  armAngles?: Array<number | null>;     // 3投分の腕角度（度数）、未記録はnull（v1.1）
  targetLabel?: TargetLabel;
  targetPoint?: Point | null;
};

export type AnalysisRecord = {
  id: string;
  date: string;
  mode: AnalysisMode;
  memo: string;
  handedness: Handedness;
  videoUri?: string;
  detailInputState?: DetailInputState;
  groupingScore?: number;
  releaseStabilityScore?: number;
  aimAccuracyScore?: number;
};

export type AppSettings = {
  handedness: Handedness;
  futureFaceMaskEnabled: boolean;
};

export type PersistedAppState = {
  settings: AppSettings;
  records: AnalysisRecord[];
};
