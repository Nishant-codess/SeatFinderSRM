"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, LogOut, QrCode, User, Loader2, BarChart3, MessageSquare, Github } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = user?.isAdmin ?? false;
  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && isAdmin && !isAdminRoute) router.replace('/admin/analytics');
  }, [loading, user, isAdmin, isAdminRoute, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin && !isAdminRoute) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Admin on admin route — admin layout handles its own chrome
  if (isAdmin && isAdminRoute) return <>{children}</>;

  const navItems = [
    { href: '/seats',     label: 'Seats',    icon: LayoutGrid },
    { href: '/dashboard', label: 'Dashboard', icon: User },
    { href: '/scanner',   label: 'Scanner',   icon: QrCode },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/seats" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/images/logo.png" width={32} height={32} alt="SeatFinderSRM" className="rounded-full" />
            <span className="font-bold text-base hidden sm:inline-block tracking-tight">SeatFinderSRM</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('gap-2 h-8', isActive && 'font-medium')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">
                    {(user.email ?? 'U').charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="pb-1.5">
                  <p className="text-sm font-medium leading-none truncate">{user.email?.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/statistics" className="cursor-pointer gap-2">
                    <BarChart3 className="h-3.5 w-3.5" /> My Statistics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/feedback" className="cursor-pointer gap-2">
                    <MessageSquare className="h-3.5 w-3.5" /> Feedback
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive gap-2">
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden border-t bg-background">
          <nav className="flex items-center px-2 py-1.5 max-w-6xl mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('w-full gap-1.5 h-9 rounded-lg', isActive && 'bg-secondary font-medium')}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto py-6 px-4">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <Image src="/images/logo.png" width={28} height={28} alt="SeatFinderSRM" className="rounded-full" />
              <div>
                <p className="font-semibold text-sm">SeatFinderSRM</p>
                <p className="text-xs text-muted-foreground">Library Seat Booking</p>
              </div>
            </div>

            {/* Links */}
            <nav className="flex gap-4 text-sm">
              <Link href="/seats" className="text-muted-foreground hover:text-foreground transition-colors">Seats</Link>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              <Link href="/feedback" className="text-muted-foreground hover:text-foreground transition-colors">Feedback</Link>
              <Link href="/statistics" className="text-muted-foreground hover:text-foreground transition-colors">Statistics</Link>
            </nav>

            {/* Credits */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Department of Computing Technologies, SRMIST</p>
              <p className="flex items-center gap-1 flex-wrap">
                Built by{' '}
                <a href="https://github.com/nidhi-nayana" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">Nidhi</a>,{' '}
                <a href="https://github.com/tanisheesh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">Tanish</a>{' '}
                &amp;{' '}
                <a href="https://github.com/nishant-codess" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">Nishant</a>
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} SRM Institute of Science and Technology</p>
            <a
              href="https://github.com/tanisheesh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
