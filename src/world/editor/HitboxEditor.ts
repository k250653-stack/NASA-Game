/**
 * In-game hitbox editor for the HQ map (F2 in dev builds). Shows every polygon with its vertices
 * and edits the raw map JSON in place; the scene rebuilds collision and occlusion after each
 * change, so the player can walk around to test straight away. Ctrl+S downloads hq-map.json and
 * copies it to the clipboard. Instructions: docs/NOTES-FOR-REVIEW.md.
 */
import Phaser from 'phaser'
import { tokenColor } from '../hqArt'
import type { HqMapJson } from '../hqMap'

export const EDIT_KINDS = ['walkable', 'blocked', 'occluder', 'doorway', 'station'] as const
export type EditKind = (typeof EDIT_KINDS)[number]

type Pt = [number, number]

interface Shape {
  kind: EditKind
  label: string
  pts: Pt[]
  color: number
  /** Removes it from the JSON; false when it cannot be removed (room floors). */
  remove: () => boolean
  /** Occluders only. */
  baseY?: { get: () => number; set: (y: number) => void }
}

const KIND_COLOR: Record<EditKind, string> = {
  walkable: 'success',
  blocked: 'danger',
  occluder: 'role-comms',
  doorway: 'alert',
  station: 'role-director',
}

/** Hit radii in screen pixels (divided by the zoom for world pixels). */
const VERTEX_HIT = 7
const EDGE_HIT = 5
const VERTEX_SIZE = 5

export class HitboxEditor {
  private readonly scene: Phaser.Scene
  private readonly raw: HqMapJson
  private readonly onChange: (raw: HqMapJson) => void
  private readonly editable: boolean
  private readonly g: Phaser.GameObjects.Graphics
  private readonly status: HTMLDivElement
  private visible = false
  private kind: EditKind = 'blocked'
  private selected: Shape | null = null
  private drag: { shape: Shape; index: number } | null = null
  private creating: Pt[] | null = null
  private mouse: Pt = [0, 0]

  constructor(
    scene: Phaser.Scene,
    raw: HqMapJson,
    onChange: (raw: HqMapJson) => void,
    editable: boolean,
  ) {
    this.scene = scene
    this.raw = raw
    this.onChange = onChange
    this.editable = editable
    this.g = scene.add.graphics().setDepth(10).setVisible(false)
    this.status = document.createElement('div')
    this.status.className =
      'pointer-events-none absolute top-14 left-4 z-20 max-w-xl border border-border-strong bg-bg/90 px-2 py-1 font-mono text-xs text-primary whitespace-pre'
    this.status.hidden = true
    scene.game.canvas.parentElement?.appendChild(this.status)

    scene.input.mouse?.disableContextMenu()
    scene.input.on('pointerdown', this.onDown, this)
    scene.input.on('pointermove', this.onMove, this)
    scene.input.on('pointerup', this.onUp, this)
    window.addEventListener('keydown', this.onKey)
    scene.events.once('shutdown', () => this.destroy())
  }

  isVisible(): boolean {
    return this.visible
  }

  toggle(): void {
    this.visible = !this.visible
    this.g.setVisible(this.visible)
    this.status.hidden = !this.visible
    this.creating = null
    this.drag = null
    this.draw()
    console.log(
      this.visible
        ? `[world] F2 ${this.editable ? 'hitbox editor' : 'overlay'} on: click logs WORLD coordinates`
        : '[world] F2 off',
    )
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey)
    this.status.remove()
  }

  // ---- shapes from the JSON ------------------------------------------------------------------

  private shapes(): Shape[] {
    const r = this.raw
    const out: Shape[] = []
    const removeAt =
      <T>(list: T[], item: T) =>
      () => {
        const i = list.indexOf(item)
        if (i < 0) return false
        list.splice(i, 1)
        return true
      }
    for (const room of r.rooms)
      out.push({
        kind: 'walkable',
        label: `floor ${room.id}`,
        pts: room.floor as Pt[],
        color: tokenColor(KIND_COLOR.walkable),
        remove: () => false,
      })
    for (const o of r.outdoor)
      out.push({
        kind: 'walkable',
        label: 'walkable (extra)',
        pts: o as Pt[],
        color: tokenColor(KIND_COLOR.walkable),
        remove: removeAt(r.outdoor, o),
      })
    for (const b of r.blocked)
      out.push({
        kind: 'blocked',
        label: 'blocker',
        pts: b as Pt[],
        color: tokenColor(KIND_COLOR.blocked),
        remove: removeAt(r.blocked, b),
      })
    for (const o of r.occluders)
      out.push({
        kind: 'occluder',
        label: `occluder ${o.id} (baseY ${o.baseY})`,
        pts: o.area as Pt[],
        color: tokenColor(KIND_COLOR.occluder),
        remove: removeAt(r.occluders, o),
        baseY: { get: () => o.baseY, set: (y) => (o.baseY = y) },
      })
    for (const d of r.doorways)
      out.push({
        kind: 'doorway',
        label: `doorway ${d.id}`,
        pts: d.area as Pt[],
        color: tokenColor(d.color),
        remove: removeAt(r.doorways, d),
      })
    for (const s of r.stations)
      out.push({
        kind: 'station',
        label: `station ${s.id}`,
        pts: s.area as Pt[],
        color: tokenColor(KIND_COLOR.station),
        remove: removeAt(r.stations, s),
      })
    return out
  }

  /** Adds a finished new polygon of the current kind to the JSON. */
  private addShape(pts: Pt[]): void {
    const r = this.raw
    const n = Date.now() % 100000
    switch (this.kind) {
      case 'walkable':
        r.outdoor.push(pts)
        break
      case 'blocked':
        r.blocked.push(pts)
        break
      case 'occluder':
        r.occluders.push({
          id: `occluder-${n}`,
          baseY: Math.max(...pts.map((p) => p[1])),
          area: pts,
        })
        break
      case 'doorway':
        r.doorways.push({
          id: `door-${n}`,
          label: 'New doorway',
          color: 'accent',
          room: r.rooms[0]!.id,
          area: pts,
        })
        break
      case 'station':
        r.stations.push({
          id: `station-${n}`,
          label: 'New station',
          room: r.rooms[0]!.id,
          opens: 'planning',
          area: pts,
          reach: 48,
        })
        break
    }
  }

  // ---- input -------------------------------------------------------------------------------

  private world(p: Phaser.Input.Pointer): Pt {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y)
    return [Math.round(w.x), Math.round(w.y)]
  }

  private tol(px: number): number {
    return px / this.scene.cameras.main.zoom
  }

  private hitVertex(at: Pt): { shape: Shape; index: number } | null {
    for (const shape of this.shapes().reverse())
      for (let i = 0; i < shape.pts.length; i++) {
        const [x, y] = shape.pts[i]!
        if (Math.hypot(x - at[0], y - at[1]) <= this.tol(VERTEX_HIT)) return { shape, index: i }
      }
    return null
  }

  private hitEdge(at: Pt): { shape: Shape; index: number; point: Pt } | null {
    for (const shape of this.shapes().reverse()) {
      const pts = shape.pts
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!
        const [bx, by] = pts[(i + 1) % pts.length]!
        const dx = bx - ax
        const dy = by - ay
        const t = Math.max(
          0,
          Math.min(1, ((at[0] - ax) * dx + (at[1] - ay) * dy) / (dx * dx + dy * dy || 1)),
        )
        const px = ax + t * dx
        const py = ay + t * dy
        if (Math.hypot(at[0] - px, at[1] - py) <= this.tol(EDGE_HIT))
          return { shape, index: i + 1, point: [Math.round(px), Math.round(py)] }
      }
    }
    return null
  }

  private hitInside(at: Pt): Shape | null {
    // Smaller, more specific shapes first.
    const order: EditKind[] = ['station', 'occluder', 'doorway', 'blocked', 'walkable']
    const all = this.shapes()
    for (const kind of order)
      for (const s of all.filter((x) => x.kind === kind).reverse())
        if (Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(s.pts.flat()), at[0], at[1]))
          return s
    return null
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.visible) return
    const at = this.world(p)
    console.log(`[world] world px: [${at[0]}, ${at[1]}]`)
    if (!this.editable) return
    if (this.creating) {
      if (p.leftButtonDown()) this.creating.push(at)
      this.draw()
      return
    }
    const v = this.hitVertex(at)
    if (p.rightButtonDown()) {
      if (v && v.shape.pts.length > 3) {
        v.shape.pts.splice(v.index, 1)
        this.changed()
      }
      return
    }
    if (v) {
      this.selected = v.shape
      this.drag = v
    } else {
      const e = this.hitEdge(at)
      if (e) {
        e.shape.pts.splice(e.index, 0, e.point)
        this.selected = e.shape
        this.drag = { shape: e.shape, index: e.index }
      } else {
        this.selected = this.hitInside(at)
      }
    }
    this.draw()
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.visible) return
    this.mouse = this.world(p)
    if (this.drag) {
      this.drag.shape.pts[this.drag.index] = this.mouse
      this.draw()
    } else if (this.creating) {
      this.draw()
    }
  }

  private onUp(): void {
    if (!this.drag) return
    this.drag = null
    this.changed()
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.visible || !this.editable) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      this.save()
      return
    }
    const n = Number(e.key)
    if (n >= 1 && n <= EDIT_KINDS.length) {
      this.kind = EDIT_KINDS[n - 1]!
    } else if (e.key === 'n' || e.key === 'N') {
      this.creating = []
      this.selected = null
    } else if (e.key === 'Enter' && this.creating) {
      if (this.creating.length >= 3) {
        this.addShape(this.creating)
        this.creating = null
        this.changed()
      }
    } else if (e.key === 'Backspace' && this.creating) {
      if (this.creating.length > 0) this.creating.pop()
      else this.creating = null
    } else if (e.key === 'Delete' && this.selected) {
      if (this.selected.remove()) {
        this.selected = null
        this.changed()
      } else console.warn('[world] room floors cannot be deleted; move their vertices instead')
    } else if ((e.key === 'b' || e.key === 'B') && this.selected?.baseY) {
      this.selected.baseY.set(this.mouse[1])
      this.changed()
    } else return
    this.draw()
  }

  private changed(): void {
    this.onChange(this.raw)
    this.draw()
  }

  // ---- output ------------------------------------------------------------------------------

  private save(): void {
    const text =
      JSON.stringify(this.raw, null, 2).replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2]') + '\n'
    navigator.clipboard?.writeText(text).catch(() => undefined)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'hq-map.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    console.log('[world] hq-map.json downloaded and copied: replace src/world/rooms/hq-map.json')
  }

  private draw(): void {
    const g = this.g
    g.clear()
    if (!this.visible) return
    const line = this.tol(1)
    const box = this.tol(VERTEX_SIZE)
    for (const s of this.shapes()) {
      const pts = s.pts.map(([x, y]) => new Phaser.Math.Vector2(x, y))
      const sel = s === this.selected || (this.selected && s.pts === this.selected.pts)
      g.fillStyle(s.color, sel ? 0.35 : 0.18).fillPoints(pts, true)
      g.lineStyle(sel ? line * 3 : line, s.color, 1).strokePoints(pts, true)
      if (s.baseY) {
        const xs = s.pts.map((p) => p[0])
        g.lineStyle(line * 2, s.color, 1)
        g.lineBetween(Math.min(...xs), s.baseY.get(), Math.max(...xs), s.baseY.get())
      }
      if (this.editable) {
        g.fillStyle(sel ? 0xffffff : s.color, 1)
        for (const [x, y] of s.pts) g.fillRect(x - box / 2, y - box / 2, box, box)
      }
    }
    if (this.creating) {
      const c = tokenColor(KIND_COLOR[this.kind])
      g.lineStyle(line * 2, c, 1)
      const pts = [...this.creating, this.mouse]
      for (let i = 1; i < pts.length; i++)
        g.lineBetween(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1])
      g.fillStyle(c, 1)
      for (const [x, y] of this.creating) g.fillRect(x - box / 2, y - box / 2, box, box)
    }
    this.status.textContent = this.editable
      ? `HITBOX EDITOR  new type: ${EDIT_KINDS.indexOf(this.kind) + 1} ${this.kind}` +
        (this.creating
          ? `  ·  creating (${this.creating.length} pts, Enter closes, Backspace undoes)`
          : '') +
        (this.selected ? `\nselected: ${this.selected.label}` : '') +
        '\ndrag vertex · click edge = add · right-click vertex = delete · 1-5 type · N new · Del remove · B baseY · Ctrl+S save'
      : 'F2 overlay (read-only in this build) · click logs world coordinates'
  }
}
