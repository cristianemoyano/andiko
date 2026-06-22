import { OrgMonogram } from '../components/OrgMonogram'
import { PoweredByAndiko } from '../components/AndikoMark'

export function SplashScreen({ orgName }: { orgName?: string | null }) {
  return (
    <div className="flex h-screen bg-zinc-950 items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-4">
          <OrgMonogram name={orgName} size="lg" />
          {orgName && (
            <span className="text-zinc-100 text-lg font-semibold tracking-tight text-center max-w-xs truncate">
              {orgName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      <div className="absolute bottom-8">
        <PoweredByAndiko labelClassName="text-zinc-500" />
      </div>
    </div>
  )
}
