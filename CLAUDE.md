# darts-analyzer Project Constitution

## 1. Core Info
- **Project Name**: darts-analyzer
- **Tech Stack**: React Native (Expo), TypeScript
- **Run Command**: `cd C:\dev\darts-analyzer && npx expo start -c`
- **Storage**: `darts-analyzer/app-state/v1` (AsyncStorage)

## 2. Source of Truth
⚠️ **進捗管理・タスク・TODOは `task.md` を唯一の真実（Source of Truth）とする。**
このファイル（CLAUDE.md）に進捗や履歴を書き込まないこと。詳細な技術仕様やロジックは `.claude/rules/` 配下を参照。

## 3. Landmines & Constraints (地雷原)
- **UIの罠**: shadow/glow系は癖があるため過信・多用しない。カレンダーのはみ出しバグ等が発生しやすい。
- **座標系の罠**: ボード外縁半径(0.46)は目視推定のため、±5%のズレを常に考慮すること。
- **ライブラリ**: `expo-av` のdeprecation警告はSDK54まで放置でよい。
- **改行コード**: Windows CRLF問題防止のため、文字列処理時は `.replace(/\r\n/g, '\n')` 等で正規化すること。
- **AIの振る舞い**: 難しい・不確かなことを「可能」と絶対に断言しないこと。
- **新アーキテクチャ**: `newArchEnabled=false` を維持すること。`@react-native-voice/voice` が New Architecture 非対応のため。ON に戻すと Manifest merger エラーで音声機能がビルド不能になる。
- **Jetifier**: `android.enableJetifier=true` を維持すること。`@react-native-voice/voice` が古い `com.android.support` に依存しているため必須。
- **git除外**: `.claude/settings.local.json` と `.claude/worktrees/` はコミット不要のローカルファイル。

## 5. ドキュメント振り分けルール
- **CLAUDE.md**: 不変の制約・地雷・ルールのみ（進捗・履歴は書かない）
- **task.md**: Todo / Completed / Blockers（進捗のSource of Truth）
- **.claude/rules/tech_specs.md**: 解析フロー・スコア計算・UIロジック等の技術仕様
- 新機能の設計仕様が固まったら `.claude/rules/` 配下に追記する
- セッション終了時に完了タスクを `task.md` の `✅ Completed` に移す

## 4. Escalation Rules
- 既存コードの意図が不明な場合や、複数の実装方針がある場合は、勝手に推測せず、必ず選択肢を提示してユーザーの判断を仰ぐ。
- 不明点やバグの特定が難航した場合は、`task.md` の `## Blockers` に記録し、即座に報告する。
