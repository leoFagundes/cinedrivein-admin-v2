import type { ClosureSchedule } from "@/types";

/** Valida os campos de uma única programação (datas e horários coerentes). */
export function validateScheduleFields(schedule: ClosureSchedule): string | null {
  if (!schedule.reason.trim()) return "Preencha o motivo da programação.";
  if (!schedule.fromDate || !schedule.toDate) return "Preencha as datas de início e fim.";
  if (schedule.toDate < schedule.fromDate)
    return "A data final não pode ser antes da data inicial.";
  if (!schedule.allDay) {
    if (!schedule.startTime || !schedule.endTime)
      return "Preencha o horário de início e fim.";
    if (schedule.endTime <= schedule.startTime)
      return "O horário final deve ser depois do horário inicial.";
  }
  return null;
}

/** Duas programações (já sabidamente ativas) ocupam a mesma janela de data/hora? */
export function rangesOverlap(a: ClosureSchedule, b: ClosureSchedule): boolean {
  const datesOverlap = a.fromDate <= b.toDate && b.fromDate <= a.toDate;
  if (!datesOverlap) return false;

  // Se qualquer uma cobre o dia todo, qualquer sobreposição de datas já é conflito.
  if (a.allDay || b.allDay) return true;

  // Ambas têm horário específico — o mesmo horário se repete em todos os dias
  // do intervalo, então basta comparar as janelas de horário uma vez.
  return a.startTime! < b.endTime! && b.startTime! < a.endTime!;
}

/** Primeira colisão entre programações ativas, ou null se não houver nenhuma. */
export function findScheduleConflict(
  schedules: ClosureSchedule[],
): { a: ClosureSchedule; b: ClosureSchedule } | null {
  const active = schedules.filter((s) => s.active);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (rangesOverlap(active[i], active[j])) {
        return { a: active[i], b: active[j] };
      }
    }
  }
  return null;
}
