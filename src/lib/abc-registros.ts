import { PERIODOS, rangoDePeriodo } from '@/lib/abc';

export type ReportRow = {
  id: string; studentId: string; teacherId: string | null; otherTeacherName: string | null;
  reportDate: string; dayOfWeek: number; context: string; contextNote: string | null; timeSlot: string;
  presentPeople: string[]; presentNames: string | null; behaviors: string[]; involvedWith: string | null;
  situationDescription: string | null; antecedents: string | null; consequences: string | null;
  redirectActions: string | null; reasons: string[] | null; reasonOther: string | null;
  effectivenessRating: string | null; comments: string | null; createdAt: string;
};

export const TIME_PRESETS: { value: string; label: string }[] = [...PERIODOS];
export const getDateRange = (preset: string): { from: Date; to: Date } | null => rangoDePeriodo(preset);
export function label<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
  return arr.find((x) => x.value === val)?.label ?? val;
}
