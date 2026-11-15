import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { resetAll, useStore } from '@/store'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { useSettings } from '@/ui/settingsStore'
import { useUi } from '@/ui/uiStore'
import { useWorld } from '@/world/worldStore'
import { AboutModal } from './menu/AboutModal'
import { MenuBackground } from './menu/MenuBackground'
import { MenuList, type MenuItem } from './menu/MenuList'
import { LAUNCH, useMenuLaunch } from './menu/menuLaunch'
import { SettingsModal } from './menu/SettingsModal'

/** The UI kit (styleguide) is only reachable with ?dev=1 in the URL. */
const DEV = new URLSearchParams(window.location.search).get('dev') === '1'

/** Main menu: full-screen pixel-art backdrop, title, and a short text menu. */
export default function Title() {
  const setPhase = useStore((s) => s.setPhase)
  const hasSave = useStore((s) => s.game.destinationId !== null)
  const setSandboxStart = useUi((s) => s.setSandboxStart)
  const resetWorld = useWorld((s) => s.resetWorld)
  const [modal, setModal] = useState<'settings' | 'about' | 'new-game' | null>(null)
  /** Which new game the "start a new mission?" confirm is for. */
  const [pending, setPending] = useState<'play' | 'sandbox'>('play')
  const reducedSetting = useSettings((s) => s.reducedMotion)
  const reducedOs = useReducedMotion()
  const reduced = reducedSetting || Boolean(reducedOs)
  const launch = useMenuLaunch(reduced)
  const launching = launch.t !== null || launch.fade.opacity > 0

  // Play starts in the HQ lobby; Sandbox keeps the direct screen flow for now.
  const newGame = (sandbox: boolean) => {
    resetAll()
    resetWorld()
    setSandboxStart(sandbox)
    // Play first picks the astronaut, then walks into the HQ.
    setPhase(sandbox ? 'destination' : 'appearance')
  }
  /** The rocket on the pad launches first; then the new game starts (CONTINUE never launches). */
  const launchInto = (mode: 'play' | 'sandbox') => {
    setModal(null)
    launch.start(() => newGame(mode === 'sandbox'))
  }
  const ask = (mode: 'play' | 'sandbox') => {
    // A save would be wiped, so ask first.
    if (!hasSave) return launchInto(mode)
    setPending(mode)
    setModal('new-game')
  }

  const items: MenuItem[] = [
    {
      id: 'start-mission-button',
      label: 'Play game',
      onSelect: () => ask('play'),
    },
    {
      id: 'menu-continue',
      label: 'Continue game',
      disabled: !hasSave,
      hint: hasSave ? undefined : 'No saved mission yet',
      onSelect: () => setPhase('hq'),
    },
    { id: 'menu-sandbox', label: 'Sandbox mode', onSelect: () => ask('sandbox') },
    { id: 'menu-settings', label: 'Settings', onSelect: () => setModal('settings') },
    { id: 'menu-about', label: 'About the event', onSelect: () => setModal('about') },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden" data-testid="main-menu">
      <MenuBackground launchT={launch.t} />
      <div
        className={`relative flex min-h-screen flex-col justify-center px-[8vw] py-16 ${launching ? 'pointer-events-none' : ''}`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: launching ? 0 : 1 }}
          transition={{ duration: launching ? LAUNCH.textFadeMs / 1000 : 1.2, ease: 'easeOut' }}
        >
          <h1 className="font-title text-6xl font-medium tracking-[0.3em] text-primary uppercase xl:text-8xl">
            Mission Control
          </h1>
          <p className="mt-4 font-title text-sm tracking-[0.4em] text-muted uppercase">
            Design a crewed mission to the Moon or Mars
          </p>
          <nav aria-label="Main menu" className="mt-14">
            <MenuList items={items} />
          </nav>
        </motion.div>
      </div>
      {DEV && (
        <button
          type="button"
          onClick={() => setPhase('styleguide')}
          className="absolute right-4 bottom-4 font-mono text-xs text-subtle hover:text-primary"
        >
          Dev: UI kit
        </button>
      )}
      <SettingsModal open={modal === 'settings'} onClose={() => setModal(null)} />
      <AboutModal open={modal === 'about'} onClose={() => setModal(null)} />
      <Modal
        open={modal === 'new-game'}
        onClose={() => setModal(null)}
        title="Start a new mission?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => launchInto(pending)} data-testid="confirm-new-game">
              Start new
            </Button>
          </>
        }
      >
        <p className="text-muted">Your current progress will be lost.</p>
      </Modal>
      {/* Fade to black at the end of the launch (or a short fade when skipped / reduced motion). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90] bg-bg transition-opacity"
        style={{ opacity: launch.fade.opacity, transitionDuration: `${launch.fade.ms}ms` }}
      />
    </main>
  )
}
