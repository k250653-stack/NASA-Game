/** Minimal types for the parts of the zzfx package the game uses (src/ui/sfx.ts). */
declare module 'zzfx' {
  export const ZZFX: {
    volume: number
    sampleRate: number
    audioContext: AudioContext
    buildSamples: (...params: number[]) => number[]
    playSamples: (
      channels: number[][],
      volumeScale?: number,
      rate?: number,
      pan?: number,
      loop?: boolean,
    ) => AudioBufferSourceNode & { gainNode: GainNode }
  }
  export function zzfx(...params: number[]): AudioBufferSourceNode
}
