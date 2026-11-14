# Theme

The whole look of Mission Control comes from one block of CSS variables: the `@theme` block at
the top of [src/index.css](src/index.css). Tailwind v4 turns each variable into utilities, so
`--color-accent` gives `bg-accent`, `text-accent`, `border-accent` and `bg-accent/20`.

Tailwind's default palette and fonts are switched off (`--color-*: initial`), so only these
tokens exist. A class like `text-slate-400` will not work, by design.

## Change the whole theme

1. Open `src/index.css`.
2. Edit values in the `@theme` block. Do not rename tokens unless you also update components.
3. Save. Vite hot-reloads and every screen updates.

Example: set `--color-accent: #a78bfa;` and every button, focus ring, selected card, stepper and
bar turns violet.

## Colours

| Token                                      | Utility                | Used for                                         |
| ------------------------------------------ | ---------------------- | ------------------------------------------------ |
| `--color-bg`                               | `bg-bg`                | Page background behind everything                |
| `--color-surface`                          | `bg-surface`           | Top bar, wells, chip backgrounds, bar tracks     |
| `--color-panel`                            | `bg-panel`             | Panels and cards                                 |
| `--color-panel-raised`                     | `bg-panel-raised`      | Hover states, secondary buttons, modals, toasts  |
| `--color-border`                           | `border-border`        | Default thin lines                               |
| `--color-border-strong`                    | `border-border-strong` | Emphasised lines, hovered cards                  |
| `--color-primary`                          | `text-primary`         | Main text                                        |
| `--color-muted`                            | `text-muted`           | Secondary text and labels                        |
| `--color-subtle`                           | `text-subtle`          | Hints and units; still meets WCAG AA on panels   |
| `--color-accent`                           | `*-accent`             | Primary accent (cyan): actions, selection, focus |
| `--color-accent-strong`                    | `*-accent-strong`      | Accent hover                                     |
| `--color-on-accent`                        | `text-on-accent`       | Text on accent fills                             |
| `--color-alert`                            | `*-alert`              | Alert accent (amber): warnings, power drawn      |
| `--color-danger`                           | `*-danger`             | Critical states, destructive buttons             |
| `--color-success`                          | `*-success`            | Nominal states, gains                            |
| `--color-trait-thinker/-practical/-leader` | `*-trait-*`            | Crew trait badges                                |
| `--color-star`                             | read by `Starfield`    | Star colour on the canvas background             |
| `--color-grid`                             | body background        | Faint 48 px grid lines                           |

## Type

| Token            | Utility               | Font                                                   |
| ---------------- | --------------------- | ------------------------------------------------------ |
| `--font-display` | `font-display`        | Space Grotesk: headings, buttons, wordmark             |
| `--font-sans`    | `font-sans` (default) | Inter: body text                                       |
| `--font-mono`    | `font-mono`           | JetBrains Mono: every number (use with `tabular-nums`) |

Fonts are self-hosted with `@fontsource` packages imported in `src/main.tsx`. To swap a font,
install another `@fontsource/<name>` package, change the imports in `main.tsx` and the token
value in `index.css`.

## Shape, spacing, depth

| Token                  | Utility               | Value                                   |
| ---------------------- | --------------------- | --------------------------------------- |
| `--radius-sm/md/lg/xl` | `rounded-sm/md/lg/xl` | 4 / 8 / 12 / 16 px                      |
| `--spacing`            | `p-4`, `gap-2`, ...   | 0.25rem base unit                       |
| `--spacing-topbar`     | `h-topbar`            | Top bar height                          |
| `--spacing-sidebar`    | sidebar column        | Right sidebar width                     |
| `--container-content`  | `max-w-content`       | Max content width at 1920 px            |
| `--shadow-panel`       | `shadow-panel`        | Subtle panel depth                      |
| `--shadow-glow`        | `shadow-glow`         | Selected card glow (follows the accent) |
| `--shadow-modal`       | `shadow-modal`        | Modals, toasts, tooltips                |

Focus rings are one global `:focus-visible` rule in `index.css`, drawn in the accent colour.
