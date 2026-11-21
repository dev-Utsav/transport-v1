/** Printed challan number: prefix + zero-padded serial, e.g. "KDR/0042". Prefix is set in Settings. */
export function formatChallanNo(no: number, prefix: string): string {
  return `${prefix}${String(no).padStart(4, "0")}`;
}
