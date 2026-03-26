import { Point } from "@/domain/types";
import { scoreFromAimAccuracy, scoreFromPointCluster } from "@/domain/scoring";

export type AnalysisEngine = {
  computeGroupingScore: (hits: Point[]) => number;
  computeReleaseStabilityScore: (releasePoints: Point[]) => number;
  computeAimAccuracyScore: (hits: Point[], targetPoint: Point) => number;
};

// This boundary keeps future MediaPipe or custom CV pipelines swappable.
export const mockAnalysisEngine: AnalysisEngine = {
  computeGroupingScore: (hits) => scoreFromPointCluster(hits, 1.6),
  computeReleaseStabilityScore: (releasePoints) =>
    scoreFromPointCluster(releasePoints, 1.9),
  // NOTE: scale 2.0 は要実機調整。距離0.5（ボード幅の半分）で0点になる設定。
  computeAimAccuracyScore: (hits, targetPoint) =>
    scoreFromAimAccuracy(hits, targetPoint, 2.0),
};
