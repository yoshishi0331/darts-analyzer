import { Handedness, Point } from "@/domain/types";

export type PoseJointName = "neck" | "shoulder" | "elbow" | "wrist";

export type PoseSkeleton = Record<PoseJointName, Point>;

export type ThrowPoseOverlay = {
  trajectory: Point[];
  skeleton: PoseSkeleton;
  wrist: Point;
};

export type PoseOverlayFrame = {
  throws: ThrowPoseOverlay[];
};

type OverlayInput = {
  releasePoints: Point[];
  currentTimeSeconds: number;
  durationSeconds: number;
  handedness: Handedness;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function lerpPoint(start: Point, end: Point, progress: number): Point {
  return {
    x: lerp(start.x, end.x, progress),
    y: lerp(start.y, end.y, progress),
  };
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function buildTrajectoryPoints(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  count = 26,
) {
  return Array.from({ length: count }, (_, index) =>
    cubicPoint(start, control1, control2, end, index / Math.max(count - 1, 1)),
  );
}

function getBaseTrajectory(index: number, handedness: Handedness) {
  const side = handedness === "right" ? 1 : -1;

  return {
    wristStart: { x: side === 1 ? 0.2 : 0.8, y: 0.78 - index * 0.015 },
    wristControl1: { x: side === 1 ? 0.2 : 0.8, y: 0.56 - index * 0.02 },
    wristControl2: { x: side === 1 ? 0.28 : 0.72, y: 0.28 + index * 0.012 },
    shoulderBase: { x: side === 1 ? 0.7 : 0.3, y: 0.34 },
    neckBase: { x: 0.55, y: 0.26 },
    elbowBase: { x: side === 1 ? 0.67 : 0.33, y: 0.5 },
  };
}

function buildThrowOverlay(
  releasePoint: Point,
  index: number,
  progress: number,
  handedness: Handedness,
): ThrowPoseOverlay {
  const base = getBaseTrajectory(index, handedness);
  const side = handedness === "right" ? 1 : -1;

  const wristEnd = {
    x: clamp(releasePoint.x, 0.08, 0.92),
    y: clamp(releasePoint.y, 0.12, 0.88),
  };
  const wristControl2 = {
    x: lerp(base.wristControl2.x, wristEnd.x - side * 0.08, 0.45),
    y: lerp(base.wristControl2.y, wristEnd.y + 0.03, 0.6),
  };

  const trajectory = buildTrajectoryPoints(
    base.wristStart,
    base.wristControl1,
    wristControl2,
    wristEnd,
  );
  const wrist = cubicPoint(
    base.wristStart,
    base.wristControl1,
    wristControl2,
    wristEnd,
    progress,
  );
  const elbowTarget = {
    x: wrist.x - side * 0.11,
    y: wrist.y + 0.12,
  };
  const elbow = lerpPoint(base.elbowBase, elbowTarget, clamp(progress * 0.9, 0, 1));
  const shoulder = lerpPoint(base.shoulderBase, { x: elbow.x - side * 0.08, y: elbow.y - 0.16 }, 0.16);
  const neck = base.neckBase;

  return {
    trajectory,
    wrist,
    skeleton: {
      neck,
      shoulder,
      elbow,
      wrist,
    },
  };
}

// This adapter is shaped so a future MediaPipe Pose Landmarker pipeline can swap in
// real joint coordinates without changing the video UI drawing layer.
export function buildPoseOverlayFrame({
  releasePoints,
  currentTimeSeconds,
  durationSeconds,
  handedness,
}: OverlayInput): PoseOverlayFrame {
  const progress = durationSeconds > 0 ? clamp(currentTimeSeconds / durationSeconds, 0, 1) : 0;

  return {
    throws: releasePoints.map((point, index) =>
      buildThrowOverlay(point, index, progress, handedness),
    ),
  };
}
