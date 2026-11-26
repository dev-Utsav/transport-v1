import { daysInMonth } from "@/lib/dates";

export type SalaryInput = {
  monthlySalary: number;
  month: string;
  present: number;
  halfDays: number;
  /** Advances owed at the month's end: given this month plus what earlier months couldn't cover. */
  advance: number;
  deduction: number;
};

export type SalaryResult = {
  totalDays: number;
  paidDays: number;
  earned: number;
  /** Advance taken off this month's pay. */
  advanceCut: number;
  /** Advance the pay couldn't cover: taken off next month (client rule, 2026-11-25). */
  advanceCarried: number;
  net: number;
};

/**
 * Fixed monthly salary, paid for the days worked: present days count fully, half days count
 * as half. Earned = monthly × paid days ÷ days in the month, rounded to whole rupees once, like
 * a paper register. Deductions come off first, then advances, as far as the pay goes; the
 * rest of the advance carries to the next month instead of being lost.
 * (Per-trip driver allowance is an open point with the client; see docs/PROGRESS.md.)
 */
export function calcSalary(input: SalaryInput): SalaryResult {
  const totalDays = daysInMonth(input.month);
  const paidDays = Math.min(totalDays, input.present + input.halfDays / 2);
  const earnedPaise = (input.monthlySalary * paidDays) / totalDays;
  const earned = Math.round(earnedPaise / 100) * 100;
  const afterDeduction = Math.max(0, earned - input.deduction);
  const advance = Math.max(0, input.advance);
  const advanceCut = Math.min(advance, afterDeduction);
  return {
    totalDays,
    paidDays,
    earned,
    advanceCut,
    advanceCarried: advance - advanceCut,
    net: afterDeduction - advanceCut,
  };
}
