/** Semantic tones shared by chips, bars and toasts. */
export type Tone = 'neutral' | 'accent' | 'alert' | 'danger' | 'success'

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-primary',
  accent: 'text-accent',
  alert: 'text-alert',
  danger: 'text-danger',
  success: 'text-success',
}

export const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-muted',
  accent: 'bg-accent',
  alert: 'bg-alert',
  danger: 'bg-danger',
  success: 'bg-success',
}
