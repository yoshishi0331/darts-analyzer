import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { mockAnalysisEngine } from "@/domain/analysisAdapter";
import {
  AnalysisRecord,
  AppSettings,
  BodyPart,
  DetailInputState,
  Handedness,
  PersistedAppState,
} from "@/domain/types";
import { loadPersistedState, savePersistedState } from "@/storage/storage";

type SaveDetailPayload = {
  memo: string;
  videoUri?: string;
  detailInputState: DetailInputState;
};

type SaveResult = {
  ok: boolean;
  message: string;
};

type AppContextValue = {
  ready: boolean;
  settings: AppSettings;
  records: AnalysisRecord[];
  selectedThrow: number;
  selectedBodyPart: BodyPart;
  setHandedness: (value: Handedness) => void;
  setFutureFaceMaskEnabled: (enabled: boolean) => void;
  setSelectedThrow: (value: number) => void;
  setSelectedBodyPart: (value: BodyPart) => void;
  saveDetailAnalysis: (payload: SaveDetailPayload) => Promise<SaveResult>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const fallbackState: PersistedAppState = {
  settings: {
    handedness: "right",
    futureFaceMaskEnabled: false,
  },
  records: [],
};

function sortNewestFirst(records: AnalysisRecord[]): AnalysisRecord[] {
  return [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function createRecordId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState<PersistedAppState | null>(null);
  const [selectedThrow, setSelectedThrow] = useState(0);
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>("wrist");

  useEffect(() => {
    loadPersistedState().then((state) => {
      setPersisted(state);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || !persisted) {
      return;
    }

    // Persist centrally so future sync can replace only this layer.
    savePersistedState(persisted);
  }, [persisted, ready]);

  const value = useMemo<AppContextValue>(() => {
    const activeState = persisted ?? fallbackState;

    const updateSettings = (next: Partial<AppSettings>) => {
      setPersisted((current) =>
        current
          ? {
              ...current,
              settings: {
                ...current.settings,
                ...next,
              },
            }
          : current,
      );
    };

    const saveDetailAnalysis = async ({
      memo,
      videoUri,
      detailInputState,
    }: SaveDetailPayload): Promise<SaveResult> => {
      const groupingScore = mockAnalysisEngine.computeGroupingScore(detailInputState.boardHits);
      const releaseStabilityScore = mockAnalysisEngine.computeReleaseStabilityScore(
        detailInputState.releasePoints,
      );
      const { targetLabel, targetPoint } = detailInputState;
      const aimAccuracyScore = targetLabel != null && targetPoint != null
        ? mockAnalysisEngine.computeAimAccuracyScore(detailInputState.boardHits, targetPoint)
        : undefined;
      // 合計スコア計算（グルーピング×0.4 ＋ リリース安定×0.4 ＋ 狙い精度×0.2）
      const totalScore = Math.round(
        groupingScore * 0.4 + releaseStabilityScore * 0.4 + (aimAccuracyScore ?? 0) * 0.2,
      );

      const record: AnalysisRecord = {
        id: createRecordId("detail"),
        date: new Date().toISOString(),
        mode: "detail",
        memo,
        videoUri,
        handedness: activeState.settings.handedness,
        detailInputState,
        groupingScore,
        releaseStabilityScore,
        aimAccuracyScore,
      };

      setPersisted({
        ...activeState,
        records: sortNewestFirst([record, ...activeState.records]),
      });

      const aimMsg = aimAccuracyScore != null ? ` / 狙い精度 ${aimAccuracyScore}点` : "";
      return {
        ok: true,
        message: `解析を保存しました。グルーピング ${groupingScore}点 / リリース安定度 ${releaseStabilityScore}点${aimMsg} / 合計 ${totalScore}点`,
      };
    };

    return {
      ready,
      settings: activeState.settings,
      records: sortNewestFirst(activeState.records),
      selectedThrow,
      selectedBodyPart,
      setHandedness: (handedness) => updateSettings({ handedness }),
      setFutureFaceMaskEnabled: (enabled) =>
        updateSettings({ futureFaceMaskEnabled: enabled }),
      setSelectedThrow,
      setSelectedBodyPart,
      saveDetailAnalysis,
    };
  }, [persisted, ready, selectedBodyPart, selectedThrow]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  return context;
}
