'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type LandingRevealProps = {
  children: React.ReactNode
  className?: string
  /** Stagger delay step (0–4), maps to 80ms increments. */
  delay?: 0 | 1 | 2 | 3 | 4
}

export function LandingReveal({ children, className, delay = 0 }: LandingRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'landing-reveal',
        delay > 0 && `landing-reveal-delay-${delay}`,
        visible && 'landing-reveal-visible',
        className,
      )}
    >
      {children}
    </div>
  )
}
