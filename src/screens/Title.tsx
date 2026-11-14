import { PhaseShell } from '@/ui/PhaseShell'
import { AssetImage } from '@/ui/AssetImage'

export default function Title() {
  return (
    <PhaseShell
      title="Mission Control"
      description="Title screen. Will offer New Game, Continue, Demo Run (fixed seed) and the Codex."
      hideBack
      nextLabel="New game"
    >
      <AssetImage
        kind="backgrounds"
        id="title"
        label="Title background"
        className="h-48 w-full rounded-md object-cover"
      />
      <p className="mt-4 text-sm text-slate-500">
        The image above is loaded from{' '}
        <span className="text-accent">/assets/backgrounds/title.webp</span>. Until that file exists,
        a generated placeholder is shown instead of a broken image.
      </p>
    </PhaseShell>
  )
}
