import type { DoctorResult } from '../application/contracts.js';

export function getDoctorExitCode(result: Pick<DoctorResult, 'checks'>): number {
  return result.checks.some((check) => check.status === 'warn') ? 2 : 0;
}
