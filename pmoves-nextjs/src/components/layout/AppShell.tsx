'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const navigationLinks = [
  { href: '/analytics', label: 'Analytics' },
  { href: '/sensitivity', label: 'Sensitivity' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        className="skip-nav sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <header
        className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40"
        role="banner"
      >
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/analytics"
            className="text-lg font-semibold hover:text-primary transition-colors touch-target"
            aria-label="PMOVES Simulator - Home"
          >
            PMOVES Simulator
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4" role="navigation" aria-label="Main navigation">
            {navigationLinks.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary px-3 py-2 rounded-md touch-target',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="border-t py-4 text-center text-sm text-muted-foreground" role="contentinfo">
        <div className="container">
          PMOVES Economic Simulator &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
