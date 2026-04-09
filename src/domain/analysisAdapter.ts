import { Point } from "@/domain/types";
import { groupingScore, scoreFromAimAccuracy, scoreFromPointCluster } from "@/domain/scoring";

export type AnalysisEngine = {
  computeGroupingScore: (hits: Point[]) => number;
  computeReleaseStabilityScore: (releasePoints: Point[]) => number;
  computeAimAccuracyScore: (hits: Point[], targetPoint: Point) => number;
};

// This boundary keeps future MediaPipe or custom CV pipelines swappable.
export const mockAnalysisEngine: AnalysisEngine = {
  computeGroupingScore: (hits) => groupingScore(hits, 2.8), // 旧: scoreFromPointCluster(hits, 1.6)
  computeReleaseStabilityScore: (releasePoints) =>
    scoreFromPointCluster(releasePoints, 1.9), // 旧: 2.8（一時変更→仕様通り1.9に戻す）
  // NOTE: scale は要実機調整。距離0.5（ボード幅の半分）で0点になる設定。
  computeAimAccuracyScore: (hits, targetPoint) =>
    scoreFromAimAccuracy(hits, targetPoint, 3.2), // 旧: 2.0
};
