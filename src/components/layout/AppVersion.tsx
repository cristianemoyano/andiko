import { cn } from '@/lib/utils'
import { getAppVersion } from '@/lib/app-version'

interface AppVersionProps {
  className?: string
}

export function AppVersion({ className }: AppVersionProps) {
  return (
    <span
      className={cn(
        'font-mono text-[10px] text-zinc-400 select-none tabular-nums',
        className,
      )}
      title="Versión desplegada"
    >
      {getAppVersion()}
    </span>
  )
}
