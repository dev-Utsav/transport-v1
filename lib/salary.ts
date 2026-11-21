import { daysInMonth } from "@/lib/dates";

export type SalaryInput = {
  monthlySalary: number;
  month: string;
  present: number;
  halfDays: number;
  advance: number;
  deduction: number;
};

export type SalaryResult = {
  totalDays: number;
  paidDays: number;
  earned: number;
  net: number;
};

/**
 * Fixed monthly salary, paid for the days worked: present days count fully, half days count
 * as half. Earned = monthly × paid days ÷ days in the month, then advances and deductions
 * come off. Rounded to whole rupees once, at the end, like a paper register.
 * (Per-trip driver allowance is an open point with the client; see docs/PROGRESS.md.)
 */
export function calcSalary(input: SalaryInput): SalaryResult {
  const totalDays = daysInMonth(input.month);
  const paidDays = Math.min(totalDays, input.present + input.halfDays / 2);
  const earnedPaise = (input.monthlySalary * paidDays) / totalDays;
  const earned = Math.round(earnedPaise / 100) * 100;
  const net = Math.max(0, earned - input.advance - input.deduction);
  return { totalDays, paidDays, earned, net };
}
