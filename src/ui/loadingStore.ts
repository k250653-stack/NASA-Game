/**
 * Loading progress for the pixel loading screen: Phaser scenes report 0-1 while they load
 * images, and null when done. Read with selectors: useLoading((s) => s.progress).
 */
import { create } from 'zustand'

interface LoadingState {
  progress: number | null
}

export const useLoading = create<LoadingState>()(() => ({ progress: null }))

export function reportLoading(progress: number | null): void {
  useLoading.setState({ progress })
}
