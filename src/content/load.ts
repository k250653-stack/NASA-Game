/**
 * Loads every JSON content file, validates it against its Zod schema and cross-checks ids.
 * Call loadContent() once at startup. It throws a readable ContentValidationError on bad data.
 */
import { z } from 'zod'
import {
  ConstantsSchema,
  type Constants,
  CrewMemberSchema,
  DestinationSchema,
  GameEventSchema,
  LessonSchema,
  PartSchema,
  RocketSchema,
  ScenarioSchema,
  type CrewMember,
  type Destination,
  type GameEvent,
  type Lesson,
  type Part,
  type Rocket,
  type Scenario,
} from '@/schemas'
import destinationsJson from './destinations.json'
import scenariosJson from './scenarios.json'
import crewJson from './crew.json'
import partsJson from './parts.json'
import rocketsJson from './rockets.json'
import eventsJson from './events.json'
import lessonsJson from './lessons.json'
import constantsJson from './constants.json'

export interface GameContent {
  constants: Constants
  destinations: Destination[]
  scenarios: Scenario[]
  crew: CrewMember[]
  parts: Part[]
  rockets: Rocket[]
  events: GameEvent[]
  lessons: Lesson[]
}

export class ContentValidationError extends Error {
  readonly file: string
  readonly issues: string[]

  constructor(file: string, issues: string[]) {
    super(`Invalid content in src/content/${file}:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
    this.name = 'ContentValidationError'
    this.file = file
    this.issues = issues
  }
}

/** Every content file is `{ "_note"?: string, "items": [...] }` so numbers can carry a caveat. */
function contentFile<T extends z.ZodType>(item: T) {
  return z.strictObject({
    _note: z.string().optional(),
    items: z.array(item),
  })
}

/** Turns a Zod path like ["items", 2, "skills", "power"] into `items[2] (id "x") -> skills.power`. */
function describePath(path: ReadonlyArray<PropertyKey>, data: unknown): string {
  const parts: string[] = []
  let itemLabel = ''
  path.forEach((segment, index) => {
    if (typeof segment === 'number') {
      parts[parts.length - 1] = `${parts[parts.length - 1] ?? ''}[${segment}]`
      if (index === 1 && path[0] === 'items') {
        const items = (data as { items?: unknown[] } | null)?.items
        const item = items?.[segment] as { id?: unknown } | undefined
        if (item && typeof item.id === 'string') itemLabel = ` (id "${item.id}")`
      }
    } else {
      parts.push(String(segment))
    }
  })
  return parts.length === 0 ? '<root>' : `${parts.join('.')}${itemLabel}`
}

export function parseContentFile<T extends z.ZodType>(
  file: string,
  itemSchema: T,
  data: unknown,
): z.output<T>[] {
  const result = contentFile(itemSchema).safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${describePath(issue.path, data)}: ${issue.message}`,
    )
    throw new ContentValidationError(file, issues)
  }
  return result.data.items
}

/** constants.json is a single object, not an items list. */
export function parseConstants(data: unknown): Constants {
  const result = ConstantsSchema.safeParse(data)
  if (!result.success) {
    throw new ContentValidationError(
      'constants.json',
      result.error.issues.map((issue) => `${describePath(issue.path, data)}: ${issue.message}`),
    )
  }
  return result.data
}

function assertUniqueIds(file: string, items: ReadonlyArray<{ id: string }>): void {
  const seen = new Set<string>()
  const dupes = items.filter((i) => (seen.has(i.id) ? true : (seen.add(i.id), false)))
  if (dupes.length > 0) {
    throw new ContentValidationError(
      file,
      dupes.map((d) => `id "${d.id}" appears more than once`),
    )
  }
}

/** Cross-file reference checks that a single-file schema cannot express. */
function checkReferences(content: GameContent): void {
  const destinationIds = new Set(content.destinations.map((d) => d.id))
  const problems: Array<[string, string]> = []

  content.scenarios.forEach((s) => {
    if (!destinationIds.has(s.destinationId)) {
      problems.push([
        'scenarios.json',
        `scenario "${s.id}" -> destinationId "${s.destinationId}" does not exist in destinations.json`,
      ])
    }
  })
  content.events.forEach((e) => {
    e.destinations.forEach((d) => {
      if (!destinationIds.has(d)) {
        problems.push([
          'events.json',
          `event "${e.id}" -> destinations contains "${d}", which does not exist in destinations.json`,
        ])
      }
    })
  })
  content.rockets.forEach((r) => {
    Object.keys(r.capacityKgByDestination).forEach((d) => {
      if (!destinationIds.has(d)) {
        problems.push([
          'rockets.json',
          `rocket "${r.id}" -> capacityKgByDestination has key "${d}", which does not exist in destinations.json`,
        ])
      }
    })
  })

  if (problems.length > 0) {
    const [firstFile] = problems[0] as [string, string]
    throw new ContentValidationError(
      firstFile,
      problems.map(([file, msg]) => (file === firstFile ? msg : `${file}: ${msg}`)),
    )
  }
}

/** Validates raw JSON objects (exported so tests can feed in deliberately broken data). */
export function validateContent(raw: {
  constants: unknown
  destinations: unknown
  scenarios: unknown
  crew: unknown
  parts: unknown
  rockets: unknown
  events: unknown
  lessons: unknown
}): GameContent {
  const content: GameContent = {
    constants: parseConstants(raw.constants),
    destinations: parseContentFile('destinations.json', DestinationSchema, raw.destinations),
    scenarios: parseContentFile('scenarios.json', ScenarioSchema, raw.scenarios),
    crew: parseContentFile('crew.json', CrewMemberSchema, raw.crew),
    parts: parseContentFile('parts.json', PartSchema, raw.parts),
    rockets: parseContentFile('rockets.json', RocketSchema, raw.rockets),
    events: parseContentFile('events.json', GameEventSchema, raw.events),
    lessons: parseContentFile('lessons.json', LessonSchema, raw.lessons),
  }
  ;(
    [
      ['destinations.json', content.destinations],
      ['scenarios.json', content.scenarios],
      ['crew.json', content.crew],
      ['parts.json', content.parts],
      ['rockets.json', content.rockets],
      ['events.json', content.events],
      ['lessons.json', content.lessons],
    ] as const
  ).forEach(([file, items]) => assertUniqueIds(file, items))
  checkReferences(content)
  return content
}

export const RAW_CONTENT = {
  constants: constantsJson,
  destinations: destinationsJson,
  scenarios: scenariosJson,
  crew: crewJson,
  parts: partsJson,
  rockets: rocketsJson,
  events: eventsJson,
  lessons: lessonsJson,
} as const

let cached: GameContent | null = null

/** Validates all bundled content once and caches it. Throws ContentValidationError if invalid. */
export function loadContent(): GameContent {
  if (!cached) cached = validateContent(RAW_CONTENT)
  return cached
}

/** Validated content. Call loadContent() at startup first. */
export function getContent(): GameContent {
  if (!cached) throw new Error('getContent() called before loadContent()')
  return cached
}
