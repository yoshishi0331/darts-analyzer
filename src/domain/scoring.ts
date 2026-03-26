import { Point } from "@/domain/types";

function averagePoint(points: Point[]): Point {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function averageDistance(points: Point[]): number {
  if (points.length === 0) {
    return 0;
  }

  const center = averagePoint(points);
  const totalDistance = points.reduce((sum, point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  return totalDistance / points.length;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Soft scaling keeps MVP scores easier to understand and a little generous.
export function scoreFromPointCluster(points: Point[], scale = 1.8): number {
  if (points.length < 3) {
    return 0;
  }

  // Points are normalized, so rescale to preserve the original score feel.
  const distance = averageDistance(points) * 100;
  return clampScore(100 - distance * scale);
}

export type GroupingResult = { score: number; missFlag: boolean };

// 3点間距離の中央値をベースにしたグルーピングスコア。
// 1点だけ大きく外れている場合（最大距離/中央値 > 閾値）に missFlag を立てる。
export function groupingScoreWithMiss(points: Point[], scale: number): GroupingResult {
  if (points.length < 3) return { score: 0, missFlag: false };

  const [a, b, c] = points as [Point, Point, Point];
  const dist = (p: Point, q: Point) =>
    Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2) * 100;

  const d12 = dist(a, b);
  const d13 = dist(a, c);
  const d23 = dist(b, c);
  const sorted = [d12, d13, d23].sort((x, y) => x - y);
  const median = sorted[1]!;
  const maxDist = sorted[2]!;

  let score = clampScore(100 - median * scale);
  let missFlag = false;

  // TODO: 閾値3は仮設定。実機確認後に調整する
  if (median > 0 && maxDist / median > 3) {
    score = clampScore(Math.round(score * 0.85));
    missFlag = true;
  }

  return { score, missFlag };
}

// 着弾点の重心とtargetPointの距離で狙い精度を算出。
// scale は要実機調整（現在 2.0 ≒ 距離0.5で0点）。
export function scoreFromAimAccuracy(hits: Point[], targetPoint: Point, scale: number): number {
  if (hits.length === 0) return 0;
  const centroid = averagePoint(hits);
  const dx = centroid.x - targetPoint.x;
  const dy = centroid.y - targetPoint.y;
  const dist = Math.sqrt(dx * dx + dy * dy) * 100;
  return clampScore(100 - dist * scale);
}

export function toStars(score?: number): number {
  if (typeof score !== "number") {
    return 0;
  }

  if (score >= 88) return 5;
  if (score >= 74) return 4;
  if (score >= 58) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

// ── getFeedback ──────────────────────────────────────────────────────────────

export type FeedbackInput = {
  releaseScore: number;
  groupingScore: number;
  aimScore: number | null;
  boardHits: { x: number; y: number }[];
  targetPoint: { x: number; y: number } | null;
};

export type FeedbackResult = {
  main: string;
  direction: string | null;
} | null;

type Direction = "上" | "下" | "左" | "右";

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// 着弾重心とリファレンス点（target or ボード中心）のベクトルで方向を判定
function getDirection(
  hits: { x: number; y: number }[],
  targetPoint: { x: number; y: number } | null,
): Direction | null {
  const centroid = averagePoint(hits);
  const ref = targetPoint ?? { x: 0.5, y: 0.5 };
  const dx = centroid.x - ref.x;
  const dy = centroid.y - ref.y;
  if (Math.sqrt(dx * dx + dy * dy) < 0.06) return null;
  if (dy < 0 && Math.abs(dy) > Math.abs(dx)) return "上";
  if (dy > 0 && Math.abs(dy) > Math.abs(dx)) return "下";
  if (dx < 0 && Math.abs(dx) >= Math.abs(dy)) return "左";
  return "右";
}

// 3投目が1・2投目ペアから大きく外れているか
function isThirdDartOutlier(hits: { x: number; y: number }[]): boolean {
  const centroid01 = {
    x: (hits[0]!.x + hits[1]!.x) / 2,
    y: (hits[0]!.y + hits[1]!.y) / 2,
  };
  const d01 = dist2d(hits[0]!, hits[1]!);
  const d2 = dist2d(hits[2]!, centroid01);
  return d2 >= 2 * d01;
}

const DIRECTION_TEXT: Record<Direction, string> = {
  上: "リリースのタイミングが早すぎる（手首フリック）可能性があります。腕が伸びきる直前でリリースする意識を持ちましょう。",
  下: "リリース後に肘が落ちている（エルボードロップ）可能性があります。フォロースルーで肘を上に保つ意識を持ちましょう。",
  左: "体がボードに対して左を向きすぎているか、リリース時に体全体が動いている可能性があります。前足をボードに向けて構え直してみましょう。",
  右: "肘が外側に開いた状態で投げている可能性があります。肘をボードの方向に向けることを意識してみましょう。",
};

export function getFeedback(input: FeedbackInput): FeedbackResult {
  const { releaseScore, groupingScore, boardHits, targetPoint } = input;

  if (boardHits.length < 3) return null;

  // 未入力点（フォールバック値）が含まれていたらスキップ
  if (boardHits.some((h) => h.x === 0.5 && h.y === 0.5)) return null;

  // 3投目ズレ判定（最優先）
  if (isThirdDartOutlier(boardHits)) {
    return {
      main: "1・2投目は安定していますが、3投目がズレています。次のダーツを早く持ちすぎているため、無意識に投げ方が変わっている可能性があります。3投目を投げ終わるまで持ち手に意識を向けてみましょう。",
      direction: null,
    };
  }

  const releaseOK = releaseScore >= 70;
  const groupingOK = groupingScore >= 70;
  const dir = getDirection(boardHits, targetPoint);
  const dirText = dir ? DIRECTION_TEXT[dir] : null;

  // A: 両方OK
  if (releaseOK && groupingOK) {
    return {
      main: dir
        ? `3投がきれいにまとまっています。ただ${dir}に寄る傾向があります。スタンスの向きを少し調整するだけで改善できます。`
        : "リリースとグルーピングともに安定しています。このフォームを継続してください。",
      direction: dir ? dirText : null,
    };
  }

  // B: リリースOK・グルーピングNG
  if (releaseOK && !groupingOK) {
    let main: string;
    if (dir === "上" || dir === "下") {
      main = "リリース位置は安定していますが、着弾が上下にばらけています。リリース後の肘の高さを意識してみましょう。肘が落ちると着弾も下がります。";
    } else if (dir === "左" || dir === "右") {
      main = "リリース位置は安定していますが、着弾が左右にばらけています。フォロースルーの向きが毎回変わっている可能性があります。リリース後も手をボードに向けたまま伸ばす意識を持ちましょう。";
    } else {
      main = "リリース位置は安定していますが、着弾がランダムにバラけています。グリップの力みが原因の可能性があります。ダーツをもう少し軽く持つことを意識してみましょう。";
    }
    return { main, direction: dirText };
  }

  // C: リリースNG・グルーピングOK
  if (!releaseOK && groupingOK) {
    return {
      main: "着弾はまとまっていますが、毎回リリース位置が変わっています。体が無意識に補正してまとめているため、疲れると崩れやすくなります。セットアップ（構えの位置）を毎回固定することで安定感が増します。",
      direction: null,
    };
  }

  // D: 両方NG
  return {
    main: dir
      ? `リリース位置と着弾の両方にばらつきがありますが、${dir}に寄る傾向があります。まずスタンスと肘の向きを確認してみましょう。`
      : "リリース位置と着弾の両方にばらつきがあります。グリップの力みかリリースのタイミングが不安定な可能性があります。まず毎回同じ位置で構えることを意識しましょう。",
    direction: dirText,
  };
}
