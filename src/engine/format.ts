/** Number formatting for engine explanations. Fixed locale so output is identical everywhere. */

const formatters = new Map<number, Intl.NumberFormat>()

/** 2340 -> "2,340"; 31.94 with digits 1 -> "31.9"; Infinity -> "unlimited". */
export function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return n > 0 ? 'unlimited' : '−unlimited'
  let f = formatters.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits })
    formatters.set(digits, f)
  }
  return f.format(n)
}

/** 0.234 -> "23%". */
export function fmtPct(ratio: number): string {
  return `${fmt(ratio * 100)}%`
}
