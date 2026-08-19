
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import type { Booking } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import QRCode from 'react-qr-code';
import { Button } from './ui/button';
import { Download, CheckCircle2, Clock, Armchair } from 'lucide-react';
import QRCodeLib from 'qrcode';

function ActiveBookingCard({ booking }: { booking: Booking }) {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (booking.status !== 'pending' && booking.status !== 'active') return;

    const calc = () => Math.max(0, 300 - (Date.now() - new Date(booking.bookingTime).getTime()) / 1000);
    setCountdown(calc());
    const t = setInterval(() => {
      const r = calc();
      setCountdown(r);
      if (r <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [booking]);

  const downloadQRCode = async () => {
    if (!user) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 600; canvas.height = 700;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SeatFinderSRM', canvas.width / 2, 60);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Seat ${booking.seatId}`, canvas.width / 2, 90);

      const qrData = JSON.stringify({ bookingId: booking.id, userId: user.uid, seatId: booking.seatId });
      const qrUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 1 });
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => { qrImg.onload = () => resolve(); qrImg.onerror = () => reject(); qrImg.src = qrUrl; });
      ctx.fillStyle = '#ffffff';
      ctx.roundRect(150, 120, 300, 300, 12);
      ctx.fill();
      ctx.drawImage(qrImg, 160, 130, 280, 280);

      const link = document.createElement('a');
      link.download = `SeatFinderSRM-${booking.seatId}-${new Date(booking.bookingTime).toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { console.error('QR download error'); }
  };

  if (booking.status === 'active') {
    return (
      <div className="rounded-xl border bg-green-500/8 border-green-500/20 p-4 flex items-start gap-3">
        <div className="rounded-full bg-green-500/15 p-2 shrink-0 mt-0.5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <p className="font-semibold text-green-600 dark:text-green-400">Checked In</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            You&apos;re currently at seat <span className="font-mono font-semibold text-foreground">{booking.seatId}</span>. Enjoy your study session!
          </p>
        </div>
      </div>
    );
  }

  const mins = Math.floor(countdown / 60);
  const secs = Math.round(countdown % 60).toString().padStart(2, '0');
  const isUrgent = countdown <= 60;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Booking</p>
          <p className="text-xl font-bold mt-0.5">Seat {booking.seatId}</p>
        </div>
        <div className={cn('text-right', isUrgent && 'text-destructive')}>
          <p className="text-xs text-muted-foreground">Time to check in</p>
          <p className="text-2xl font-mono font-bold">{mins}:{secs}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="bg-white p-3 rounded-lg border shrink-0">
          <QRCode
            value={JSON.stringify({ bookingId: booking.id, userId: user?.uid, seatId: booking.seatId })}
            size={140}
          />
        </div>
        <div className="flex-1 text-sm space-y-2 text-center sm:text-left">
          <p className="text-muted-foreground">Scan this QR code at the library entrance to check in.</p>
          <p className="text-muted-foreground">Booked for <span className="font-medium text-foreground">{booking.duration} minutes</span>.</p>
          <Button onClick={downloadQRCode} variant="outline" size="sm" className="gap-1.5 mt-1">
            <Download className="h-3.5 w-3.5" /> Save QR
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-500/15 text-green-700 dark:text-green-400',
  pending:   'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  completed: 'bg-muted text-muted-foreground',
  expired:   'bg-red-500/10 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
};

export function BookingHistory() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch('/api/bookings', { headers: { Authorization: `Bearer ${user.accessToken}` } })
      .then((r) => r.json())
      .then((data) => setBookings(
        (data.bookings ?? []).map((b: any) => ({ ...b, id: b.bookingId ?? b.id }))
      ))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [user]);

  const activeBooking = bookings.find((b) => b.status === 'pending' || b.status === 'active');
  const historyBookings = bookings.filter((b) => b.status !== 'pending' && b.status !== 'active');

  return (
    <div className="space-y-6">
      {activeBooking && <ActiveBookingCard booking={activeBooking} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Booking History</CardTitle>
          <CardDescription>Your past and current seat bookings</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Armchair className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No bookings yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Book a seat to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => {
                const bookingDate = new Date(booking.bookingTime);
                const entryDate = booking.entryTime ? new Date(booking.entryTime) : null;
                const exitDate = booking.exitTime ? new Date(booking.exitTime) : null;
                let duration = booking.duration ? `${booking.duration}m` : '—';
                if (entryDate && exitDate) {
                  duration = `${Math.round((exitDate.getTime() - entryDate.getTime()) / 60000)}m`;
                }

                return (
                  <div key={booking.id} className="flex items-center gap-3 rounded-lg border bg-card/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold font-mono">{booking.seatId?.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{booking.seatId}</span>
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full capitalize', STATUS_STYLE[booking.status] ?? STATUS_STYLE.completed)}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {!isNaN(bookingDate.getTime()) ? format(bookingDate, 'MMM d, yyyy · h:mm a') : '—'}
                        {duration !== '—' && ` · ${duration}`}
                      </p>
                    </div>
                    {entryDate && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(entryDate, 'h:mm a')}
                        {exitDate && <> → {format(exitDate, 'h:mm a')}</>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
