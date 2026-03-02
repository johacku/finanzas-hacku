import { SOCIEDAD_FLAG_MAP, SOCIEDAD_COLOR_MAP, type Sociedad } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface SociedadBadgeProps {
  sociedad: Sociedad
  className?: string
}

export function SociedadBadge({ sociedad, className }: SociedadBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        SOCIEDAD_COLOR_MAP[sociedad],
        className
      )}
    >
      <span>{SOCIEDAD_FLAG_MAP[sociedad]}</span>
      <span>{sociedad}</span>
    </span>
  )
}
