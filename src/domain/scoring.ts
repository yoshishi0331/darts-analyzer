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
  if (score >= 93) return "SS"; // 旧: 90
  if (score >= 87) return "S";  // 旧: 82
  if (score >= 79) return "A+"; // 旧: 74
  if (score >= 71) return "A";  // 旧: 66
  if (score >= 62) return "B+"; // 旧: 58
  if (score >= 54) return "B";  // 旧: 50
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

const ARM_ANGLE_THRESHOLD = 97;
const DROP_NEGLIGIBLE = 0.02;

export type RecentSession = {
  dropped: boolean;
  armAngleLate: boolean;
};

export type FeedbackInput = {
  landingPoints: { x: number; y: number }[] | null; // null = 未測定
  targetPoint: { x: number; y: number } | null;
  armAngles: Array<number | null> | null;            // null = 未測定
  groupingScore: number | null;
  recentSessions: RecentSession[];                   // 直近3件（新しい順）
};

export type FeedbackResult = string[];

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function getMedianAngle(armAngles: Array<number | null> | null): number | null {
  if (!armAngles) return null;
  const valid = armAngles.filter((a): a is number => a !== null);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function xStdDev(points: { x: number; y: number }[]): number {
  if (points.length === 0) return 0;
  const xs = points.map((p) => p.x);
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length);
}

function isOneOutlier(points: { x: number; y: number }[]): boolean {
  if (points.length < 3) return false;
  const [a, b, c] = points as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  const d12 = dist2d(a, b);
  const d13 = dist2d(a, c);
  const d23 = dist2d(b, c);
  const sorted = [d12, d13, d23].sort((x, y) => x - y);
  const median = sorted[1]!;
  if (median < 0.001) return false;
  return sorted[2]! / median > 3;
}

// ── メインエントリ ────────────────────────────────────────────────────────────

export function getFeedback(input: FeedbackInput): FeedbackResult {
  const { landingPoints, targetPoint, armAngles, groupingScore, recentSessions } = input;

  const messages: string[] = [];

  // 着弾データ
  const hasLanding = landingPoints !== null && landingPoints.length >= 3;
  const centroid = hasLanding ? averagePoint(landingPoints!) : null;
  const yDrop = centroid && targetPoint ? centroid.y - targetPoint.y : null;
  const dropped = yDrop !== null && yDrop > DROP_NEGLIGIBLE;
  const raisedUp = centroid && targetPoint ? centroid.y < targetPoint.y - DROP_NEGLIGIBLE : false;

  // 腕角度
  const medianAngle = getMedianAngle(armAngles);
  const armMeasured = medianAngle !== null;
  const armLate = armMeasured && medianAngle! > ARM_ANGLE_THRESHOLD;

  // 直近3セッション全て同条件か
  const isThreeSessions =
    recentSessions.length >= 3 &&
    recentSessions.slice(0, 3).every((s) => s.dropped && s.armAngleLate);

  // ③ 着弾垂れ＋腕97度超え（直近3セッション継続）※①より先に評価
  if (hasLanding && dropped && armMeasured && armLate && isThreeSessions) {
    messages.push(
      "最近、垂れる傾向が続いていますね。リリースが少し遅めの可能性があります。グリップで矢が立ち気味の方はとくに、腕が伸びきる前に離すと改善することが多いです。焦らず一緒に直していきましょう！",
    );
  }

  // ① 着弾垂れ＋腕97度超え（単発）
  if (hasLanding && dropped && armMeasured && armLate && !isThreeSessions) {
    messages.push(
      "少しリリースが遅めかもしれません。腕が伸びきる前に離すイメージで、次の1投試してみましょう！",
    );
  }

  // ② 着弾垂れ＋腕97度以内
  if (hasLanding && dropped && armMeasured && !armLate) {
    messages.push(
      "リリースのタイミングは悪くないです。グリップの力みや手首を引きすぎていないか、フォロースルーが下がっていないか確認してみましょう。",
    );
  }

  // ④ 着弾正常＋腕97度超え
  if (hasLanding && !dropped && armMeasured && armLate) {
    messages.push(
      "今日の結果はバッチリです！ただ腕の角度が少し大きめなので、疲れてきたときに乱れやすいかも。余裕があるときに意識してみてください。",
    );
  }

  // ⑤ 着弾高め
  if (hasLanding && targetPoint && raisedUp) {
    messages.push(
      "全体的に高めに集まっていますね。リリースが少し早い可能性があります。もう少しだけ引きつけてから離すイメージで投げてみましょう！",
    );
  }

  // ⑥ 左右ブレ
  if (hasLanding && xStdDev(landingPoints!) > 0.08) {
    messages.push(
      "縦のコントロールは良いですね！横のブレはリリース時に手首が左右にぶれている可能性があります。肘とボードを一直線にするイメージで投げてみましょう。",
    );
  }

  // ⑦ グルーピング良好＋着弾ズレ
  if (hasLanding && targetPoint && groupingScore !== null && groupingScore >= 70 && centroid) {
    const dist = dist2d(centroid, targetPoint);
    if (dist > 0.1) {
      messages.push(
        "3本の集まりはとても良いです！フォームが安定している証拠です。あとはエイムの調整だけなので、狙う位置を少し補正してみましょう。フォームは自信持っていいです！",
      );
    }
  }

  // ⑧ グルーピングばらつき
  if (groupingScore !== null && groupingScore < 40) {
    messages.push(
      "着弾がバラついていますね。まずはスコアより『同じ動きを繰り返すこと』だけを意識するのが近道です。毎回同じフォームを最優先にしてみましょう。",
    );
  }

  // ⑨ 1本だけ極端にズレ
  if (hasLanding && isOneOutlier(landingPoints!)) {
    messages.push(
      "2本はいい感じです！1本だけズレるのはフォームより集中やリズムの乱れのことが多いです。深呼吸してルーティンを整えてみましょう。",
    );
  }

  // フォールバック
  if (messages.length === 0) {
    messages.push("今日のフォームは安定しています！この調子で続けましょう！");
  }

  return messages;
}
