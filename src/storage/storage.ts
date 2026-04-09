import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AnalysisRecord,
  AppSettings,
  Point,
  PersistedAppState,
} from "@/domain/types";

const STORAGE_KEY = "darts-analyzer/app-state/v1";

const defaultSettings: AppSettings = {
  handedness: "right",
  futureFaceMaskEnabled: false,
};

function createSeedRecords(): AnalysisRecord[] {
  return [
    {
      id: "seed-detail-1",
      date: "2026-03-16T10:10:00.000Z",
      mode: "detail",
      memo: "3投とも少し右へ抜ける。",
      handedness: "right",
      detailInputState: {
        boardHits: [
          { x: 0.46, y: 0.5 },
          { x: 0.52, y: 0.44 },
          { x: 0.57, y: 0.54 },
        ],
        releasePoints: [
          { x: 0.44, y: 0.38 },
          { x: 0.47, y: 0.36 },
          { x: 0.49, y: 0.4 },
        ],
        elbowPoints: [
          { x: 0.42, y: 0.58 },
          { x: 0.45, y: 0.56 },
          { x: 0.48, y: 0.59 },
        ],
      },
      groupingScore: 86,
      releaseStabilityScore: 80,
    },
  ];
}

function createDefaultState(): PersistedAppState {
  return {
    settings: defaultSettings,
    records: createSeedRecords(),
  };
}

function normalizePoint(point: Point): Point {
  const usesLegacyScale = point.x > 1 || point.y > 1;
  if (!usesLegacyScale) {
    return point;
  }
  return { x: point.x / 100, y: point.y / 100 };
}

function normalizeRecord(record: AnalysisRecord): AnalysisRecord {
  if (!record.detailInputState) {
    return record;
  }

  return {
    ...record,
    detailInputState: {
      ...record.detailInputState,
      boardHits: record.detailInputState.boardHits.map(normalizePoint),
      releasePoints: record.detailInputState.releasePoints.map(normalizePoint),
      elbowPoints: (record.detailInputState.elbowPoints ?? []).map((p) =>
        p === null ? null : normalizePoint(p),
      ),
      ...(record.detailInputState.shoulderPoints != null ? {
        shoulderPoints: record.detailInputState.shoulderPoints.map((p) =>
          p === null ? null : normalizePoint(p),
        ),
      } : {}),
    },
  };
}

export async function loadPersistedState(): Promise<PersistedAppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw) as PersistedAppState;
    return {
      settings: parsed.settings ?? defaultSettings,
      records: (parsed.records ?? []).map(normalizeRecord),
    };
  } catch {
    return createDefaultState();
  }
}

export async function savePersistedState(state: PersistedAppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
