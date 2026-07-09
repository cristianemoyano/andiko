'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { cn } from '@/lib/utils'

type NavLink = { label: string; href: string }

type LandingHeaderProps = {
  navLinks: readonly NavLink[]
  primaryCtaClass: string
}

export function LandingHeader({ navLinks, primaryCtaClass }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-16 border-b bg-white/70 backdrop-blur-md transition-[border-color,box-shadow] duration-200 ease-out',
        scrolled
          ? 'border-zinc-200/90 shadow-[0_1px_12px_rgba(12,100,122,0.08)]'
          : 'border-zinc-200/60 shadow-none',
      )}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-7 px-[clamp(20px,5vw,56px)]">
        <AndikoLogo size="sm" />
        <nav className="ml-3 hidden items-center gap-[26px] md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-600 transition-colors duration-150 ease-out hover:text-brand-600"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden h-[38px] items-center rounded-[4px] px-3.5 text-sm font-medium text-zinc-900 transition-colors duration-150 ease-out hover:text-brand-600 md:inline-flex"
          >
            Iniciar sesión
          </Link>
          <a href="#sec-contacto" className={`${primaryCtaClass} h-[38px] px-4 text-sm shadow-sm shadow-brand-600/25`}>
            Solicitar demo
          </a>
        </div>
      </div>
    </header>
  )
}
