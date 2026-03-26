export type Point = {
  x: number;
  y: number;
};

export type PoseSkeleton = {
  leftShoulder: Point;
  rightShoulder: Point;
  leftHip: Point;
  rightHip: Point;
  throwShoulder: Point;
  throwElbow: Point;
  throwWrist: Point;
};

export type PoseFrameSample = {
  timeMillis: number;
  skeleton: PoseSkeleton;
};

export type VideoPoseAnalysis = {
  samples: PoseFrameSample[];
};

export async function analyzeVideoPose(_input?: {
  videoUri?: string;
  durationSeconds?: number;
  handedness?: "right" | "left";
}): Promise<VideoPoseAnalysis> {
  return { samples: [] };
}

export function getNearestPoseFrame(
  analysis: VideoPoseAnalysis | null,
  currentTimeSeconds: number,
) {
  if (!analysis || !analysis.samples.length) {
    return null;
  }

  const currentMillis = currentTimeSeconds * 1000;
  return analysis.samples.reduce((nearest, sample) =>
    Math.abs(sample.timeMillis - currentMillis) < Math.abs(nearest.timeMillis - currentMillis)
      ? sample
      : nearest,
  );
}
