'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

const THRESHOLD = 64
const RESISTANCE = 2.8

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function PullToRefresh({ onRefresh, children, className, disabled }: PullToRefreshProps) {
  const startYRef = useRef<number | null>(null)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return
    const el = e.currentTarget
    if (el.scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
  }, [disabled, refreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return
    const delta = e.touches[0].clientY - startYRef.current
    if (delta <= 0) { startYRef.current = null; return }
    e.preventDefault()
    setPullY(Math.min(delta / RESISTANCE, THRESHOLD * 1.2))
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return
    startYRef.current = null
    if (pullY >= THRESHOLD) {
      setRefreshing(true)
      setPullY(0)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    } else {
      setPullY(0)
    }
  }, [pullY, onRefresh])

  const progress = Math.min(pullY / THRESHOLD, 1)
  const showIndicator = pullY > 4 || refreshing

  return (
    <div
      className={cn('relative flex-1 min-h-0 overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showIndicator && (
        <div
          className="absolute top-0 inset-x-0 flex justify-center z-10 pointer-events-none transition-[height] duration-150"
          style={{ height: refreshing ? 44 : pullY * RESISTANCE }}
        >
          <div className="flex items-center justify-center w-8 h-8 mt-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'text-fg-subtle transition-transform duration-100',
                refreshing && 'animate-spin',
              )}
              style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        </div>
      )}
      <div
        style={{ transform: pullY > 0 ? `translateY(${pullY}px)` : undefined, willChange: pullY > 0 ? 'transform' : undefined }}
        className="transition-transform duration-100 ease-out"
      >
        {children}
      </div>
    </div>
  )
}
