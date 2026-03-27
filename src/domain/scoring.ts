import { Rank } from "@/theme/rankAppearance";
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

// 3点間距離の中央値をベースにしたグルーピングスコア。
export function groupingScore(points: Point[], scale: number): number {
  if (points.length < 3) return 0;

  const [a, b, c] = points as [Point, Point, Point];
  const dist = (p: Point, q: Point) =>
    Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2) * 100;

  const d12 = dist(a, b);
  const d13 = dist(a, c);
  const d23 = dist(b, c);
  const sorted = [d12, d13, d23].sort((x, y) => x - y);
  const median = sorted[1]!;

  const raw = clampScore(100 - median * scale);
  return raw >= 98 ? 100 : raw;
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

// ── スコア集計・ランク（HomeScreen / CalendarScreen 共通） ──────────────────

/**
 * 1レコードの総合スコアを計算する。
 * 測定済み指標のみで重みを割り直す（未測定は 0 として加算しない）。
 * 1件も測定していない場合は null を返す。
 */
export function calcRecordTotalScore(
  groupingScore: number | undefined | null,
  releaseStabilityScore: number | undefined | null,
  aimAccuracyScore: number | undefined | null,
): number | null {
  const entries: { score: number; weight: number }[] = [];
  if (groupingScore != null) entries.push({ score: groupingScore, weight: 0.4 });
  if (releaseStabilityScore != null) entries.push({ score: releaseStabilityScore, weight: 0.4 });
  if (aimAccuracyScore != null) entries.push({ score: aimAccuracyScore, weight: 0.2 });
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  return Math.round(entries.reduce((s, e) => s + e.score * e.weight, 0) / totalWeight);
}

export { Rank };

export function getRank(score: number): Rank {
  if (score >= 90) return "SS";
  if (score >= 82) return "S";
  if (score >= 74) return "A+";
  if (score >= 66) return "A";
  if (score >= 58) return "B+";
  if (score >= 50) return "B";
  return "C";
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
  releaseScore: number | null;
  groupingScore: number | null;
  aimScore: number | null;
  boardHits: { x: number; y: number }[];
  targetPoint: { x: number; y: number } | null;
  measuredMetrics: { grouping: boolean; release: boolean; aim: boolean };
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
  左: "体がボードに対して左を向きすぎているか、フォロースルーが体の内側に流れている可能性があります。前足と肘をボードに向け、リリース後も手をまっすぐ前に伸ばす意識を持ちましょう。",
  右: "肘が外側に開いているか、手首のフリックが横にブレている可能性があります。肘をボードの方向に向け、フォロースルーもまっすぐ前に出す意識を持ちましょう。",
};

// ── 単一指標フィードバック ────────────────────────────────────────────────────

function feedbackGroupingOnly(
  gScore: number,
  boardHits: { x: number; y: number }[],
): FeedbackResult {
  if (isThirdDartOutlier(boardHits)) {
    return {
      main: "1・2投目は固まっていますが、3投目がズレています。次のダーツを早く持ちすぎている可能性があります。3投目を投げ終わるまで持ち手に意識を向けてみましょう。",
      direction: null,
    };
  }
  if (gScore >= 90) return { main: "3投の着弾が非常によく固まっています！この再現性を維持してください。", direction: null };
  if (gScore >= 70) return { main: "3投の着弾はまとまっています。さらに固めるには、毎回同じ軌道を意識してみましょう。", direction: null };
  if (gScore >= 50) return { main: "着弾がやや散らばっています。グリップの力みを抜いて、リラックスして投げることを意識してみましょう。", direction: null };
  return { main: "着弾がかなりばらけています。まず毎回同じフォームで構えることから始めてみましょう。", direction: null };
}

function feedbackReleaseOnly(rScore: number): FeedbackResult {
  if (rScore >= 90) return { main: "リリース位置が非常に安定しています！この再現性を維持してください。", direction: null };
  if (rScore >= 70) return { main: "リリース位置はまとまっています。さらに安定させるには、セットアップの位置を毎回固定することを意識しましょう。", direction: null };
  if (rScore >= 50) return { main: "リリース位置にやや波があります。肘の高さと構える位置を毎回そろえることを意識してみましょう。", direction: null };
  return { main: "リリース位置が大きくばらけています。まず毎回同じ位置に構えることだけを意識して投げてみてください。", direction: null };
}

function feedbackAimOnly(
  aScore: number,
  boardHits: { x: number; y: number }[],
  targetPoint: { x: number; y: number } | null,
): FeedbackResult {
  const dir = getDirection(boardHits, targetPoint);
  const dirText = dir ? DIRECTION_TEXT[dir] : null;

  if (aScore >= 90) return { main: "狙い通りに投げられています！素晴らしい精度です。", direction: null };
  if (aScore >= 70) {
    if (dir) return { main: `おおむね狙いに近いですが、${dir}にやや寄っています。スタンスを少し調整してみましょう。`, direction: dirText };
    return { main: "おおむね狙い通りです。安定したフォームを維持してください。", direction: null };
  }
  if (dir) return { main: `${dir}に大きくズレています。スタンスの向きと肘の方向を確認してみましょう。`, direction: dirText };
  return { main: "狙いから大きくズレています。スタンスの向きとリリースのタイミングを見直しましょう。", direction: null };
}

// ── 2指標フィードバック ───────────────────────────────────────────────────────

function feedbackGroupingAndAim(
  gScore: number,
  aScore: number,
  boardHits: { x: number; y: number }[],
  targetPoint: { x: number; y: number } | null,
): FeedbackResult {
  if (isThirdDartOutlier(boardHits)) {
    return {
      main: "1・2投目は固まっていますが、3投目がズレています。次のダーツを早く持ちすぎている可能性があります。3投目を投げ終わるまで持ち手に意識を向けてみましょう。",
      direction: null,
    };
  }

  const dir = getDirection(boardHits, targetPoint);
  const dirText = dir ? DIRECTION_TEXT[dir] : null;
  const gOK = gScore >= 70;
  const aOK = aScore >= 70;

  if (gOK && aOK) {
    if (dir) return { main: `着弾がよくまとまり、おおむね狙い通りです。${dir}にわずかに寄る傾向があるので、スタンスを微調整してみましょう。`, direction: dirText };
    return { main: "着弾がよくまとまり、狙い通りに投げられています。この調子を維持してください。", direction: null };
  }
  if (gOK && !aOK) {
    if (dir) return { main: `着弾はよくまとまっていますが、${dir}に寄っています。スタンスの向きを調整してみましょう。`, direction: dirText };
    return { main: "着弾はまとまっていますが、狙いからズレています。スタンスの向きと構える角度を確認してみましょう。", direction: null };
  }
  if (!gOK && aOK) {
    return { main: "狙いには近いですが、着弾がバラついています。毎回同じ軌道を意識して投げてみましょう。", direction: null };
  }
  if (dir) return { main: `着弾がばらけて、${dir}にもズレています。まず毎回同じフォームで構えることから始めてみましょう。`, direction: dirText };
  return { main: "着弾がバラつき、狙いからも外れています。グリップと構えを見直しましょう。", direction: null };
}

function feedbackReleaseAndAim(
  rScore: number,
  aScore: number,
  boardHits: { x: number; y: number }[],
  targetPoint: { x: number; y: number } | null,
): FeedbackResult {
  const dir = getDirection(boardHits, targetPoint);
  const dirText = dir ? DIRECTION_TEXT[dir] : null;
  const rOK = rScore >= 70;
  const aOK = aScore >= 70;

  if (rOK && aOK) {
    if (dir) return { main: `リリースが安定し、おおむね狙い通りです。${dir}にわずかに寄る傾向があるので、スタンスを微調整してみましょう。`, direction: dirText };
    return { main: "リリースが安定し、狙い通りに投げられています。この調子を維持してください。", direction: null };
  }
  if (rOK && !aOK) {
    if (dir) return { main: `リリースは安定していますが、${dir}に寄っています。スタンスの向きを調整してみましょう。`, direction: dirText };
    return { main: "リリースは安定していますが、狙いからズレています。スタンスと構える向きを確認してみましょう。", direction: null };
  }
  if (!rOK && aOK) {
    return { main: "狙いには近いですが、リリース位置がバラついています。セットアップの位置を毎回固定することを意識しましょう。", direction: null };
  }
  if (dir) return { main: `リリース位置がバラついて、${dir}にもズレています。まず毎回同じ位置に構えることを意識してみましょう。`, direction: dirText };
  return { main: "リリース位置がバラつき、狙いからも外れています。構えの位置とリリースのタイミングを見直しましょう。", direction: null };
}

// ── グルーピング＋リリース安定（2指標）/ 全部（3指標）共通 ─────────────────────
// 既存の4パターン（A/B/C/D）+ 褒め文 + allExcellent

function feedbackGroupingRelease(
  rScore: number,
  gScore: number,
  aScore: number | null,
  boardHits: { x: number; y: number }[],
  targetPoint: { x: number; y: number } | null,
): FeedbackResult {
  if (isThirdDartOutlier(boardHits)) {
    return {
      main: "1・2投目は安定していますが、3投目がズレています。次のダーツを早く持ちすぎているため、無意識に投げ方が変わっている可能性があります。3投目を投げ終わるまで持ち手に意識を向けてみましょう。",
      direction: null,
    };
  }

  const releaseOK = rScore >= 70;
  const groupingOK = gScore >= 70;
  const dir = getDirection(boardHits, targetPoint);
  const dirText = dir ? DIRECTION_TEXT[dir] : null;

  // トーン判定
  const scores: number[] = [rScore, gScore];
  if (aScore != null) scores.push(aScore);
  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  const highTone = avgScore >= 80;
  const lowTone  = avgScore <= 59;

  // 90点以上チェック
  const groupingExcellent = gScore >= 90;
  const releaseExcellent  = rScore >= 90;
  const aimExcellent      = aScore != null && aScore >= 90;
  const allExcellent      = groupingExcellent && releaseExcellent && (aScore == null || aimExcellent);

  if (allExcellent) {
    return { main: "完璧に近いフォームです！この調子で続けましょう。", direction: null };
  }

  const praiseParts: string[] = [];
  if (groupingExcellent) praiseParts.push("着弾がよく固まっています！");
  if (releaseExcellent)  praiseParts.push("リリースが非常に安定しています！");
  if (aimExcellent)      praiseParts.push("狙い通りに投げられています！");
  const praisePrefix = praiseParts.length > 0 ? praiseParts.join("　") + "　" : "";

  let patternMain: string;
  let patternDirection: string | null;

  // A: 両方OK
  if (releaseOK && groupingOK) {
    if (dir) {
      patternMain = highTone
        ? `惜しい！${dir}に少し寄っていますが、あと少しで完璧です。スタンスを微調整してみましょう。`
        : `3投がきれいにまとまっています。ただ${dir}に寄る傾向があります。スタンスの向きを少し調整するだけで改善できます。`;
      patternDirection = dirText;
    } else {
      patternMain = highTone
        ? "非常に安定しています。強いて言えば、スタンスの角度を少し意識するとさらに再現性が上がります。"
        : "リリースとグルーピングともに安定しています。このフォームを継続してください。";
      patternDirection = null;
    }

  // B: リリースOK・グルーピングNG
  } else if (releaseOK && !groupingOK) {
    if (dir === "上" || dir === "下") {
      patternMain = lowTone
        ? "ここを直すと一気に変わります。リリース後の肘の高さを意識してみましょう！"
        : "リリース位置は安定していますが、着弾が上下にばらけています。リリース後の肘がフォロースルーで自然に上がっているか確認してみましょう。途中で肘が落ちると着弾も下がります。";
    } else if (dir === "左" || dir === "右") {
      patternMain = lowTone
        ? "ここを直すと一気に変わります。フォロースルーの方向を毎回そろえることを意識してみましょう！"
        : "リリース位置は安定していますが、着弾が左右にばらけています。フォロースルーの向きが毎回変わっている可能性があります。リリース後も手をボードに向けたまま伸ばす意識を持ちましょう。";
    } else {
      patternMain = lowTone
        ? "ここを直すと一気に変わります。ダーツを軽めに持つことから試してみましょう！"
        : "リリース位置は安定していますが、着弾がランダムにバラけています。グリップの力みが原因の可能性があります。ダーツをもう少し軽く持つことを意識してみましょう。";
    }
    patternDirection = dirText;

  // C: リリースNG・グルーピングOK
  } else if (!releaseOK && groupingOK) {
    patternMain = "着弾はまとまっていますが、毎回リリース位置が変わっています。体が無意識に補正してまとめているため、疲れると崩れやすくなります。セットアップ（構えの位置）を毎回固定することで安定感が増します。";
    patternDirection = null;

  // D: 両方NG
  } else {
    patternMain = dir
      ? (lowTone
          ? `一緒に整えていきましょう。まずは${dir}へのズレを解消するため、スタンスの向きから試してみてください。`
          : `リリース位置と着弾の両方にばらつきがありますが、${dir}に寄る傾向があります。まずスタンスと肘の向きを確認してみましょう。`)
      : (lowTone
          ? "一緒に整えていきましょう。まずは毎回同じ位置に構えることだけを意識して投げてみてください。"
          : "リリース位置と着弾の両方にばらつきがあります。グリップの力みかリリースのタイミングが不安定な可能性があります。まず毎回同じ位置で構えることを意識しましょう。");
    patternDirection = dirText;
  }

  return { main: praisePrefix + patternMain, direction: patternDirection };
}

// ── メインエントリ ────────────────────────────────────────────────────────────

export function getFeedback(input: FeedbackInput): FeedbackResult {
  const { releaseScore, groupingScore, aimScore, boardHits, targetPoint, measuredMetrics } = input;
  const { grouping: mg, release: mr, aim: ma } = measuredMetrics;

  if (!mg && !mr && !ma) return null;
  if (boardHits.length < 3) return null;

  // boardHitsが実際に測定された場合（グルーピングor狙い精度）のみフォールバック値をチェック
  const hasBoardData = mg || ma;
  if (hasBoardData && boardHits.some((h) => h.x === 0.5 && h.y === 0.5)) return null;

  // ── グルーピングのみ ──
  if (mg && !mr && !ma) {
    return feedbackGroupingOnly(groupingScore!, boardHits);
  }

  // ── リリース安定のみ ──
  if (!mg && mr && !ma) {
    return feedbackReleaseOnly(releaseScore!);
  }

  // ── 狙い精度のみ ──
  if (!mg && !mr && ma) {
    return feedbackAimOnly(aimScore!, boardHits, targetPoint);
  }

  // ── グルーピング＋狙い精度 ──
  if (mg && !mr && ma) {
    return feedbackGroupingAndAim(groupingScore!, aimScore!, boardHits, targetPoint);
  }

  // ── リリース安定＋狙い精度 ──
  if (!mg && mr && ma) {
    return feedbackReleaseAndAim(releaseScore!, aimScore!, boardHits, targetPoint);
  }

  // ── グルーピング＋リリース安定 / 全部（既存A/B/C/Dパターン） ──
  return feedbackGroupingRelease(releaseScore!, groupingScore!, aimScore, boardHits, targetPoint);
}
