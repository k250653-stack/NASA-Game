/** Display-only number shortening for tight spaces. Never used for game math. */

/** 600000 -> "600k", 1250000 -> "1.3M", 842 -> "842". */
export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  const trim = (v: number) => String(Math.round(v * 10) / 10)
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (abs >= 10_000) return `${trim(n / 1000)}k`
  return Math.round(n).toLocaleString('en-US')
}

/** Money given in millions of dollars: 22 -> "$22M", 1300 -> "$1.3B". */
export function compactMoneyM(millions: number): string {
  if (Math.abs(millions) >= 1000) {
    return `$${String(Math.round(millions / 100) / 10)}B`
  }
  return `$${Math.round(millions).toLocaleString('en-US')}M`
}
