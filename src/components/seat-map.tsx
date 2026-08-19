
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Seat } from '@/components/seat';
import type { Seat as SeatType, Booking } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers/auth-provider';
import { AlertTriangle, Search, X } from 'lucide-react';

const FLOORS = ["Ground", "First", "Second", "Third"];
const SEATS_PER_FLOOR = 50;

interface LibraryStatus {
  isOpen: boolean;
  todayHours?: { open: string; close: string; isClosed: boolean };
  isHoliday?: boolean;
  holidayName?: string;
}

const LEGEND = [
  { label: 'Available',   color: 'bg-card border-2 border-primary/70' },
  { label: 'Reserved',    color: 'bg-accent/80 border-2 border-accent' },
  { label: 'Occupied',    color: 'bg-green-500/80 border-2 border-green-600' },
  { label: 'Maintenance', color: 'bg-muted border-2 border-muted-foreground/30' },
];

export function SeatMap() {
  const [seats, setSeats] = useState<Record<string, Record<string, SeatType>>>({});
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const { user } = useAuth();

  const fetchSeats = useCallback(async () => {
    try {
      const res = await fetch('/api/seats');
      if (!res.ok) return;
      const data = await res.json();
      setSeats(data.seats ?? {});
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveBooking = useCallback(async () => {
    if (!user) { setActiveBooking(null); return; }
    try {
      const res = await fetch('/api/bookings/active', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveBooking(data.booking ?? null);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchSeats();
    fetchActiveBooking();
    fetch('/api/settings').then((r) => r.json()).then(setLibraryStatus).catch(() => {});
    const si = setInterval(fetchSeats, 10_000);
    const bi = setInterval(fetchActiveBooking, 10_000);
    return () => { clearInterval(si); clearInterval(bi); };
  }, [fetchSeats, fetchActiveBooking]);

  const getSeatCounts = (floor: string) => {
    const floorSeats = seats[floor.toLowerCase()] || {};
    let available = 0;
    Object.values(floorSeats).forEach((s) => { if (s.status === 'available') available++; });
    return { available, total: Object.keys(floorSeats).length || SEATS_PER_FLOOR };
  };

  const filterSeats = (floorSeats: Record<string, SeatType>) =>
    Object.entries(floorSeats).filter(([id, s]) => {
      if (searchTerm && !id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (showAvailableOnly && s.status !== 'available') return false;
      return true;
    });

  const hasFilters = searchTerm || showAvailableOnly;

  return (
    <div className="w-full space-y-4">
      {/* Library closed banner */}
      {libraryStatus && !libraryStatus.isOpen && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {libraryStatus.isHoliday
              ? `Library is closed today — ${libraryStatus.holidayName}.`
              : libraryStatus.todayHours?.isClosed
              ? 'Library is closed today. See you next working day!'
              : `Library is currently closed. Opens at ${libraryStatus.todayHours?.open ?? '09:00'}.`}
          </span>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search seat (e.g. G01, F15)…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <label className="flex items-center gap-2 rounded-md border bg-background px-3 h-9 cursor-pointer text-sm select-none">
          <input
            type="checkbox"
            checked={showAvailableOnly}
            onChange={(e) => setShowAvailableOnly(e.target.checked)}
            className="rounded"
          />
          Available only
        </label>
        {hasFilters && (
          <button
            onClick={() => { setSearchTerm(''); setShowAvailableOnly(false); }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Floor tabs */}
      <Tabs defaultValue="ground" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto mb-1">
          {FLOORS.map((floor) => {
            const { available, total } = loading ? { available: 0, total: SEATS_PER_FLOOR } : getSeatCounts(floor);
            return (
              <TabsTrigger
                key={floor}
                value={floor.toLowerCase()}
                className="flex flex-col gap-0.5 py-2.5"
              >
                <span className="text-xs sm:text-sm font-semibold">{floor}</span>
                {!loading && (
                  <span className="text-[10px] opacity-70">
                    {available}/{total} free
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {loading ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {Array.from({ length: SEATS_PER_FLOOR }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          FLOORS.map((floor) => {
            const filtered = filterSeats(seats[floor.toLowerCase()] || {});
            return (
              <TabsContent key={floor} value={floor.toLowerCase()} className="mt-0">
                <div className="rounded-lg border bg-card p-3 sm:p-4">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <Search className="h-8 w-8 opacity-30 mb-2" />
                      <p className="text-sm">No seats match your filters</p>
                      <button
                        onClick={() => { setSearchTerm(''); setShowAvailableOnly(false); }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-3">
                      {filtered
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([seatId, seatData]) => (
                          <Seat
                            key={seatId}
                            id={seatId}
                            status={seatData.status}
                            bookedBy={seatData.bookedBy}
                            currentUserId={user?.uid}
                            userHasActiveBooking={!!activeBooking}
                          />
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })
        )}
      </Tabs>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground px-1">
        {LEGEND.map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded ${color}`} />
            {label}
          </span>
        ))}
        {activeBooking?.status === 'pending' && (
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded bg-yellow-400/80 border-2 border-yellow-500" />
            Your Booking
          </span>
        )}
      </div>
    </div>
  );
}
