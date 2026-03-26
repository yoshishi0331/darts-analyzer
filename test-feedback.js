// node test-feedback.js で実行
// getFeedback のロジックをそのまま移植した自己完結スクリプト

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function averagePoint(points) {
  const total = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function dist2d(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getDirection(hits, targetPoint) {
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

function isThirdDartOutlier(hits) {
  const centroid01 = {
    x: (hits[0].x + hits[1].x) / 2,
    y: (hits[0].y + hits[1].y) / 2,
  };
  const d01 = dist2d(hits[0], hits[1]);
  const d2 = dist2d(hits[2], centroid01);
  return d2 >= 2 * d01;
}

const DIRECTION_TEXT = {
  上: "リリースのタイミングが早すぎる（手首フリック）可能性があります。腕が伸びきる直前でリリースする意識を持ちましょう。",
  下: "リリース後に肘が落ちている（エルボードロップ）可能性があります。フォロースルーで肘を上に保つ意識を持ちましょう。",
  左: "体がボードに対して左を向きすぎているか、リリース時に体全体が動いている可能性があります。前足をボードに向けて構え直してみましょう。",
  右: "肘が外側に開いた状態で投げている可能性があります。肘をボードの方向に向けることを意識してみましょう。",
};

function getFeedback(input) {
  const { releaseScore, groupingScore, boardHits, targetPoint } = input;

  if (boardHits.length < 3) return null;
  if (boardHits.some((h) => h.x === 0.5 && h.y === 0.5)) return null;

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

  if (releaseOK && groupingOK) {
    return {
      main: dir
        ? `3投がきれいにまとまっています。ただ${dir}に寄る傾向があります。スタンスの向きを少し調整するだけで改善できます。`
        : "リリースとグルーピングともに安定しています。このフォームを継続してください。",
      direction: dir ? dirText : null,
    };
  }

  if (releaseOK && !groupingOK) {
    let main;
    if (dir === "上" || dir === "下") {
      main = "リリース位置は安定していますが、着弾が上下にばらけています。リリース後の肘の高さを意識してみましょう。肘が落ちると着弾も下がります。";
    } else if (dir === "左" || dir === "右") {
      main = "リリース位置は安定していますが、着弾が左右にばらけています。フォロースルーの向きが毎回変わっている可能性があります。リリース後も手をボードに向けたまま伸ばす意識を持ちましょう。";
    } else {
      main = "リリース位置は安定していますが、着弾がランダムにバラけています。グリップの力みが原因の可能性があります。ダーツをもう少し軽く持つことを意識してみましょう。";
    }
    return { main, direction: dirText };
  }

  if (!releaseOK && groupingOK) {
    return {
      main: "着弾はまとまっていますが、毎回リリース位置が変わっています。体が無意識に補正してまとめているため、疲れると崩れやすくなります。セットアップ（構えの位置）を毎回固定することで安定感が増します。",
      direction: null,
    };
  }

  return {
    main: dir
      ? `リリース位置と着弾の両方にばらつきがありますが、${dir}に寄る傾向があります。まずスタンスと肘の向きを確認してみましょう。`
      : "リリース位置と着弾の両方にばらつきがあります。グリップの力みかリリースのタイミングが不安定な可能性があります。まず毎回同じ位置で構えることを意識しましょう。",
    direction: dirText,
  };
}

// ── テストケース ─────────────────────────────────────────────────────────────

const cases = [
  {
    label: "① パターンA + 上direction（releaseOK+groupingOK、重心が上ズレ）",
    input: {
      releaseScore: 85,
      groupingScore: 80,
      aimScore: 90,
      // 重心 ≈ (0.50, 0.30)、targetPoint(0.5,0.5)からdy=-0.20 → 上
      boardHits: [{ x: 0.49, y: 0.30 }, { x: 0.51, y: 0.31 }, { x: 0.50, y: 0.29 }],
      targetPoint: { x: 0.5, y: 0.5 },
    },
  },
  {
    label: "② パターンB左右 + 左direction（releaseOK+groupingNG、重心が左ズレ）",
    input: {
      releaseScore: 85,
      groupingScore: 50,
      aimScore: 60,
      // 重心 ≈ (0.31, 0.50)、dx=-0.19 → 左
      boardHits: [{ x: 0.30, y: 0.48 }, { x: 0.32, y: 0.52 }, { x: 0.31, y: 0.49 }],
      targetPoint: { x: 0.5, y: 0.5 },
    },
  },
  {
    label: "③ パターンC（releaseNG+groupingOK）",
    input: {
      releaseScore: 50,
      groupingScore: 80,
      aimScore: 70,
      // 密集、重心≈(0.50, 0.493)、距離<0.06 → 方向なし
      boardHits: [{ x: 0.49, y: 0.49 }, { x: 0.51, y: 0.51 }, { x: 0.50, y: 0.48 }],
      targetPoint: null,
    },
  },
  {
    label: "④ パターンD + 右direction（releaseNG+groupingNG、重心が右ズレ）",
    input: {
      releaseScore: 50,
      groupingScore: 50,
      aimScore: 40,
      // 重心 ≈ (0.677, 0.50)、dx=+0.177 → 右
      boardHits: [{ x: 0.65, y: 0.48 }, { x: 0.68, y: 0.52 }, { x: 0.70, y: 0.49 }],
      targetPoint: { x: 0.5, y: 0.5 },
    },
  },
  {
    label: "⑤ 3投目ズレ（boardHits[2]だけ大きくズレ）",
    input: {
      releaseScore: 80,
      groupingScore: 75,
      aimScore: 70,
      // centroid01=(0.50,0.305), d01≈0.041, d2≈0.68 → 0.68 >= 0.082 → outlier
      boardHits: [{ x: 0.48, y: 0.30 }, { x: 0.52, y: 0.31 }, { x: 0.90, y: 0.85 }],
      targetPoint: null,
    },
  },
  {
    label: "⑥ フォールバック値あり → null",
    input: {
      releaseScore: 80,
      groupingScore: 75,
      aimScore: 70,
      // {x:0.5, y:0.5} が含まれているので null
      boardHits: [{ x: 0.5, y: 0.5 }, { x: 0.48, y: 0.52 }, { x: 0.52, y: 0.48 }],
      targetPoint: null,
    },
  },
];

for (const { label, input } of cases) {
  console.log(`\n=== ${label} ===`);
  const result = getFeedback(input);
  console.log(JSON.stringify(result, null, 2));
}
