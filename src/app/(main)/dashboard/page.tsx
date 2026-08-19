'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookingHistory } from "@/components/booking-history";
import { BookingExtension } from "@/components/booking-extension";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, MessageSquare, BarChart3, Clock, QrCode, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Booking } from '@/types';

interface LibraryStatus {
  isOpen: boolean;
  todayHours?: { open: string; close: string; isClosed: boolean };
  isHoliday?: boolean;
  holidayName?: string;
}

function fmt12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);

  const fetchActiveBooking = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/bookings/active`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveBooking(data.booking ?? null);
    } catch {
      setActiveBooking(null);
    }
  }, [user]);

  useEffect(() => {
    fetchActiveBooking();
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setLibraryStatus)
      .catch(() => {});
    const interval = setInterval(fetchActiveBooking, 10_000);
    return () => clearInterval(interval);
  }, [fetchActiveBooking]);

  const handleExtensionComplete = () => {
    setRefreshKey((prev) => prev + 1);
    fetchActiveBooking();
  };

  const handleCancel = async () => {
    if (!user || !activeBooking) return;
    const bookingId = (activeBooking as any).bookingId ?? activeBooking.id;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to cancel');
      setActiveBooking(null);
      setRefreshKey((k) => k + 1);
      toast({ title: 'Booking cancelled', description: 'Seat has been released.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: e.message });
    } finally {
      setCancelling(false);
    }
  };

  const username = user?.email?.split('@')[0] ?? 'Student';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline">
            Hey, {username}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back to SRM Library</p>
        </div>

        {/* Library status pill */}
        {libraryStatus && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge
              variant={libraryStatus.isOpen ? 'default' : 'secondary'}
              className={`text-sm px-3 py-1 gap-1.5 ${libraryStatus.isOpen ? 'bg-green-500/90 text-white hover:bg-green-500/90' : ''}`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${libraryStatus.isOpen ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`} />
              {libraryStatus.isHoliday
                ? `Closed — ${libraryStatus.holidayName}`
                : libraryStatus.isOpen
                ? libraryStatus.todayHours?.close
                  ? `Open · Closes ${fmt12(libraryStatus.todayHours.close)}`
                  : 'Open'
                : libraryStatus.todayHours?.isClosed
                ? 'Closed today'
                : `Closed · Opens ${fmt12(libraryStatus.todayHours?.open ?? '09:00')} tomorrow`}
            </Badge>
          </div>
        )}
      </div>

      {/* Active / pending booking card */}
      {activeBooking && ['pending', 'active'].includes(activeBooking.status) && (
        <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
          activeBooking.status === 'active'
            ? 'bg-green-500/8 border-green-500/20'
            : 'bg-amber-500/8 border-amber-500/20'
        }`}>
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${
              activeBooking.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {activeBooking.status === 'active' ? 'Checked In' : 'Pending check-in'}
            </p>
            <p className="font-bold text-lg font-mono">Seat {activeBooking.seatId}</p>
            <p className="text-xs text-muted-foreground truncate">
              Until {new Date(activeBooking.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeBooking.status === 'pending' && (
              <Link href="/scanner">
                <Button size="sm" className="gap-1.5">
                  <Clock className="h-4 w-4" /> Check In
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/seats">
          <Button variant="outline" size="sm" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Find a Seat
          </Button>
        </Link>
        <Link href="/scanner">
          <Button variant="outline" size="sm" className="gap-2">
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>
        </Link>
        <Link href="/statistics">
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            My Stats
          </Button>
        </Link>
        <Link href="/feedback">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </Button>
        </Link>
      </div>

      {/* Active booking extension */}
      {activeBooking && (
        <BookingExtension
          key={refreshKey}
          booking={activeBooking}
          onExtensionComplete={handleExtensionComplete}
        />
      )}

      {/* Booking history */}
      <BookingHistory />
    </div>
  );
}
