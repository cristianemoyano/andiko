export function SplashScreen() {
  return (
    <div className="flex h-screen bg-zinc-950 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
          <svg viewBox="0 0 12 12" className="w-5 h-5 fill-white">
            <rect x="0" y="1" width="3" height="10"/>
            <rect x="0" y="1" width="12" height="3"/>
            <rect x="9" y="1" width="3" height="10"/>
            <rect x="2" y="5" width="8" height="2.5"/>
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
