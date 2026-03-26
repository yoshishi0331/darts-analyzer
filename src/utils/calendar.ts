import { AnalysisRecord } from "@/domain/types";
import { getDateKey } from "@/utils/date";

export type CalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
};

export function createMonthGrid(baseDate = new Date()): CalendarDay[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const firstCell = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(firstCell);
    current.setDate(firstCell.getDate() + index);
    return {
      key: getDateKey(current.toISOString()),
      day: current.getDate(),
      inMonth: current.getMonth() === month,
    };
  });
}

export function groupRecordsByDate(records: AnalysisRecord[]): Record<string, AnalysisRecord[]> {
  return records.reduce<Record<string, AnalysisRecord[]>>((acc, record) => {
    const key = getDateKey(record.date);
    acc[key] = [...(acc[key] ?? []), record];
    return acc;
  }, {});
}
