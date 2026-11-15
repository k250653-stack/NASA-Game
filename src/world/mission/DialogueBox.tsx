import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { getContent } from '@/content/load'
import type { CrewMember, DialogueLine } from '@/schemas'
import { AssetImage } from '@/ui/AssetImage'
import { ROLE_LABEL } from '@/ui/labels'
import { playSound } from '@/ui/sound'
import { PopupPanel } from '../PopupPanel'
import type { EngineContent, MissionState } from '@/engine/types'
import { applyChoice, pickLine, trustOf } from './crewLife'
import type { Gauge } from './missionRun'

const CHAR_MS = 18

interface DialogueBoxProps {
  member: CrewMember
  line: DialogueLine
  /** "Check status" opens the old crew status popup. */
  onStatus: () => void
  onClose: () => void
}

/** Small pixel dialogue: portrait, name and role, typewriter text, 1-3 replies, a trust pip row. */
export function DialogueBox({ member, line, onStatus, onClose }: DialogueBoxProps) {
  const reduced = useReducedMotion()
  const [reply, setReply] = useState<string | null>(null)
  const text = reply ?? line.text
  const [shown, setShown] = useState(0)
  const [, bump] = useState(0)
  useEffect(() => setShown(0), [text])
  useEffect(() => {
    if (reduced || shown >= text.length) return
    const t = setTimeout(() => {
      if (shown % 4 === 0) playSound('typewriter')
      setShown((n) => n + 1)
    }, CHAR_MS)
    return () => clearTimeout(t)
  }, [text, shown, reduced])
  const { trustMax } = getContent().constants.dialogue
  const trust = trustOf(member.id)
  const typed = reduced || shown >= text.length
  return (
    <PopupPanel section="Crew" title={member.name} onClose={onClose}>
      <div className="mx-auto max-w-2xl px-6 py-6" data-testid="dialogue-box" data-line={line.id}>
        <div className="flex gap-4">
          <AssetImage
            kind="portraits"
            id={member.portrait}
            label={member.name}
            className="size-24 shrink-0 border-2 border-border-strong"
          />
          <div className="min-w-0 flex-1">
            <p className="label-caps text-sm text-accent">
              {member.name} · {ROLE_LABEL[member.role]}
            </p>
            <p
              className="mt-1 min-h-[4.5rem] text-lg text-primary"
              onClick={() => setShown(text.length)}
              data-testid="dialogue-text"
            >
              {reduced ? text : text.slice(0, shown)}
            </p>
            <p
              className="mt-1 flex items-center gap-1.5"
              aria-label={`Trust ${trust} of ${trustMax}`}
              data-testid="trust-pips"
            >
              <span className="label-caps mr-1 text-xs text-muted">Trust</span>
              {Array.from({ length: trustMax }, (_, i) => (
                <span
                  key={i}
                  className={`text-base ${i < trust ? 'text-role-budget' : 'text-border-strong'}`}
                >
                  ♥
                </span>
              ))}
            </p>
          </div>
        </div>
        <ul className="mt-5 space-y-2">
          {reply === null ? (
            typed &&
            line.choices.map((c, i) => (
              <li key={c.text}>
                <button
                  type="button"
                  onClick={() => {
                    applyChoice(line, i)
                    setReply(c.reply)
                    bump((n) => n + 1)
                  }}
                  className="w-full border-2 border-border-strong px-3 py-2 text-left text-primary hover:border-accent hover:text-accent"
                  data-testid={`dialogue-choice-${i}`}
                >
                  {c.text}
                  {c.startSideMission && (
                    <span className="label-caps ml-2 text-xs text-success">· side mission</span>
                  )}
                </button>
              </li>
            ))
          ) : (
            <li>
              <button
                type="button"
                onClick={onClose}
                className="w-full border-2 border-accent px-3 py-2 text-accent hover:bg-accent/10"
                data-testid="dialogue-close"
              >
                Bye for now
              </button>
            </li>
          )}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="font-mono text-xs text-muted underline"
            onClick={onStatus}
          >
            Check status
          </button>
        </div>
      </div>
    </PopupPanel>
  )
}

/** HUD: the active side mission, in green so it never looks like a problem. */
export function SideMissionList({
  title,
  brief,
  progress,
  turns,
}: {
  title: string
  brief: string
  progress: number
  turns: number
}) {
  return (
    <div className="pixel-panel mt-2 border-success px-3 py-1.5" data-testid="sidemission-list">
      <p className="label-caps text-xs text-success">Side mission · {title}</p>
      <p className="text-sm text-primary">
        {brief}
        {turns > 1 && (
          <span className="ml-1 font-mono text-xs text-muted tabular-nums">
            ({Math.min(progress, turns)}/{turns})
          </span>
        )}
      </p>
    </div>
  )
}

interface CrewTalkProps {
  member: CrewMember
  run: MissionState
  gauges: readonly Gauge[]
  content: EngineContent
  onStatus: () => void
  onClose: () => void
}

/** Picks what the crew member says once when the talk opens (it does not change mid-talk). */
export function CrewTalk({ member, run, gauges, content, onStatus, onClose }: CrewTalkProps) {
  const [picked] = useState(() => pickLine(member.id, run, gauges, content))
  useEffect(() => {
    if (!picked) onStatus()
  }, [picked, onStatus])
  if (!picked) return null
  return <DialogueBox member={member} line={picked.line} onStatus={onStatus} onClose={onClose} />
}
