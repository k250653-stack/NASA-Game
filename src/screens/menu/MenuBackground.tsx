import { AssetImage } from '@/ui/AssetImage'
import { MenuRocket } from './MenuRocket'

/** Full-screen pixel-art backdrop, darkened on the left so the menu text stays readable. */
export function MenuBackground() {
  return (
    <div className="absolute inset-0 bg-bg" aria-hidden data-testid="menu-background">
      <AssetImage
        kind="backgrounds"
        id="menu-launchpad"
        ext="png"
        alt=""
        className="absolute inset-0 size-full object-cover object-right [image-rendering:pixelated]"
      />
      <MenuRocket />
      <div className="absolute inset-0 bg-linear-to-r from-bg via-bg/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-bg/80 to-transparent" />
    </div>
  )
}
