'use client'

import { useRef, useState, useEffect } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number | null>(null)
  // Ref tracks pull distance synchronously so touchend reads the correct value
  const pullYRef = useRef(0)
  // Stable refs so effect closure never goes stale
  const onRefreshRef = useRef(onRefresh)
  const disabledRef = useRef(disabled)
  const refreshingRef = useRef(false)

  onRefreshRef.current = onRefresh
  disabledRef.current = disabled

  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // Tracks whether a gesture is active so we skip the snap-back transition while dragging
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleTouchStart(e: TouchEvent) {
      if (disabledRef.current || refreshingRef.current) return
      if (container!.scrollTop > 0) return
      startYRef.current = e.touches[0].clientY
      setIsDragging(true)
    }

    function handleTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return
      // Cancel if user scrolled down mid-gesture to prevent scroll lock
      if (container!.scrollTop > 0) {
        startYRef.current = null
        pullYRef.current = 0
        setPullY(0)
        setIsDragging(false)
        return
      }
      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0) {
        startYRef.current = null
        pullYRef.current = 0
        setPullY(0)
        setIsDragging(false)
        return
      }
      e.preventDefault()
      const clamped = Math.min(delta / RESISTANCE, THRESHOLD * 1.2)
      pullYRef.current = clamped
      setPullY(clamped)
    }

    function handleTouchEnd() {
      if (startYRef.current === null) return
      startYRef.current = null
      setIsDragging(false)
      const currentPull = pullYRef.current
      pullYRef.current = 0
      if (currentPull >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullY(0)
        void onRefreshRef.current().finally(() => {
          refreshingRef.current = false
          setRefreshing(false)
        })
      } else {
        setPullY(0)
      }
    }

    // passive: false on touchmove so preventDefault() actually works on iOS
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, []) // stable — all mutable state accessed via refs

  const progress = Math.min(pullY / THRESHOLD, 1)
  const showIndicator = pullY > 4 || refreshing

  return (
    <div
      ref={containerRef}
      className={cn('relative flex-1 min-h-0 overflow-auto', className)}
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
              className={cn('text-fg-subtle', refreshing && 'animate-spin')}
              style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        </div>
      )}
      <div
        style={{
          transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
          willChange: pullY > 0 ? 'transform' : undefined,
        }}
        // Transition only on release/snap-back, not during active drag
        className={cn(!isDragging && 'transition-transform duration-200 ease-out')}
      >
        {children}
      </div>
    </div>
  )
}
