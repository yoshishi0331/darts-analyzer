import { Point, TargetLabel } from "@/domain/types";

// トリプルエリア中心座標（BoardCanvas の正規化座標系）
// ブル以外はトリプルリング中心（103mm）を基準に算出。
// ボード外縁半径0.46は目視推定。実機確認後に微調整すること。
export const TARGET_POINTS: Record<TargetLabel, Point> = {
  bull: { x: 0.50, y: 0.50 },
  "20": { x: 0.50, y: 0.29 },
  "19": { x: 0.44, y: 0.70 },
  "18": { x: 0.62, y: 0.33 },
  "17": { x: 0.57, y: 0.70 },
  "16": { x: 0.33, y: 0.62 },
  "15": { x: 0.67, y: 0.62 },
};
