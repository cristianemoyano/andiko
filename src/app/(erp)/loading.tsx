import { Skeleton } from '@/components/primitives/Skeleton'

export default function ErpLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 h-12 flex items-center gap-3 px-4 border-b border-border bg-surface">
        <Skeleton shape="line" className="h-4 w-28" />
        <span className="flex-1" />
        <Skeleton shape="block" className="h-8 w-20 hidden sm:block" />
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 md:p-5">
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <Skeleton shape="block" className="h-[30px] w-44" />
            <Skeleton shape="block" className="h-[30px] w-28" />
          </div>
          <div className="flex items-center h-9 px-3 gap-4 border-b border-border bg-surface-muted">
            <Skeleton shape="line" className="h-3 w-20" />
            <Skeleton shape="line" className="h-3 w-28" />
            <Skeleton shape="line" className="h-3 w-16 ml-auto" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 h-11 px-3 border-b border-border last:border-0">
              <Skeleton shape="line" className="h-4 w-24 shrink-0" />
              <Skeleton shape="line" className="h-4 flex-1" />
              <Skeleton shape="line" className="h-4 w-14 shrink-0" />
              <Skeleton shape="block" className="h-5 w-14 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
