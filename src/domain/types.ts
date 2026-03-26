export type AnalysisMode = "detail";
export type Handedness = "right" | "left";
export type ThrowIndex = 0 | 1 | 2;
export type BodyPart = "wrist" | "elbow" | "shoulderArm" | "release";

// Normalized coordinates in the range [0, 1].
export type Point = {
  x: number;
  y: number;
};

export type TargetLabel = "bull" | "20" | "19" | "18" | "17" | "16" | "15";

export type DetailInputState = {
  boardHits: Point[];
  releasePoints: Point[];
  elbowPoints: Point[];
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
