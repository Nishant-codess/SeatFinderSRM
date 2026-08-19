'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Calendar,
  Users,
  Armchair,
  FileText,
  Settings,
  BarChart3,
  Menu,
  MessageSquare,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { title: 'Analytics',  href: '/admin/analytics', icon: BarChart3 },
  { title: 'Bookings',   href: '/admin/bookings',  icon: Calendar },
  { title: 'Users',      href: '/admin/users',     icon: Users },
  { title: 'Seats',      href: '/admin/seats',     icon: Armchair },
  { title: 'Feedback',   href: '/admin/feedback',  icon: MessageSquare },
  { title: 'Reports',    href: '/admin/reports',   icon: FileText },
  { title: 'Settings',   href: '/admin/settings',  icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.title}</span>
            {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-col h-full">
      {/* Logo / brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b">
        <Image src="/images/logo.png" width={30} height={30} alt="SeatFinderSRM" className="rounded-full" />
        <div>
          <p className="text-sm font-bold leading-tight">SeatFinderSRM</p>
          <p className="text-[10px] text-muted-foreground leading-tight tracking-wide uppercase">Admin Panel</p>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <NavLinks onNavigate={onNavigate} />
      </div>

      {/* User footer */}
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {(user?.email ?? 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-[10px] text-muted-foreground">Admin</p>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile FAB */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="icon" className="rounded-full shadow-xl h-14 w-14">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <VisuallyHidden><SheetTitle>Admin Navigation</SheetTitle></VisuallyHidden>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 xl:w-60 shrink-0 border-r bg-card/40 flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}
