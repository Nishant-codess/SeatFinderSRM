
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import type { Seat, Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Clock, Download, QrCode, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCodeLib from 'qrcode';

export function BookingClient({ seatId, activeBooking }: { seatId: string; activeBooking: Booking | null }) {
  const { user } = useAuth();
  const [seat, setSeat] = useState<Seat | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(activeBooking);
  const [countdown, setCountdown] = useState(0);
  const [endTime, setEndTime] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    let sh = m < 30 ? h : h + 1;
    let sm = m < 30 ? 30 : 0;
    for (let hour = sh; hour < 24; hour++) {
      const startMin = hour === sh ? sm : 0;
      for (const min of [0, 30]) {
        if (hour === sh && min < startMin) continue;
        const period = hour >= 12 ? 'PM' : 'AM';
        const dh = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        options.push(`${dh}:${min.toString().padStart(2, '0')} ${period}|${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }
    }
    return options;
  }, []);

  useEffect(() => { setBooking(activeBooking); }, [activeBooking]);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((r) => r.json())
      .then((d) => setSeat(d.seat ?? null))
      .catch(() => setSeat(null))
      .finally(() => setLoading(false));
  }, [seatId]);

  useEffect(() => {
    if (!booking || (booking.status !== 'pending' && booking.status !== 'active')) { setCountdown(0); return; }
    const calc = () => Math.max(0, 300 - (Date.now() - new Date(booking.bookingTime).getTime()) / 1000);
    setCountdown(calc());
    const t = setInterval(() => { const r = calc(); setCountdown(r); if (r <= 0) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, [booking]);

  const handleBooking = async () => {
    if (!user || !seat || seat.status !== 'available') return;
    if (activeBooking) {
      toast({ variant: 'destructive', title: 'Already booked', description: `You have an active booking for seat ${activeBooking.seatId}. Cancel it first.` });
      return;
    }
    if (!endTime) {
      toast({ variant: 'destructive', title: 'Select end time', description: 'Please choose when you want to leave.' });
      return;
    }
    setLoading(true);
    try {
      const [, t24] = endTime.split('|');
      const [hrs, mins] = t24.split(':').map(Number);
      const endDt = new Date();
      endDt.setHours(hrs, mins, 0, 0);
      if (endDt < new Date()) endDt.setDate(endDt.getDate() + 1);
      if (Math.round((endDt.getTime() - Date.now()) / 60_000) < 30) {
        toast({ variant: 'destructive', title: 'Too soon', description: 'Select an end time at least 30 minutes away.' });
        return;
      }
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ seatId, endTime: endDt.toISOString(), userId: user.uid, userEmail: user.email }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Booking failed');
      const data = await res.json();
      setBooking({ ...data.booking, id: data.booking.bookingId ?? data.booking.id });
      toast({ title: 'Seat booked!', description: `Scan QR within 5 minutes to check in.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Booking failed', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !booking) return;
    setLoading(true);
    try {
      const bookingId = (booking as any).bookingId ?? booking.id;
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to cancel');
      toast({ title: 'Booking cancelled', description: `Seat ${seatId} is now available.` });
      router.push('/seats');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = async () => {
    if (!booking || !user) return;
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
      ctx.fillText(`Seat ${seatId}`, canvas.width / 2, 90);
      const qrData = JSON.stringify({ bookingId: (booking as any).bookingId ?? booking.id, userId: user.uid, seatId });
      const qrUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 1 });
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = qrUrl; });
      ctx.fillStyle = '#ffffff';
      ctx.roundRect(150, 120, 300, 300, 12);
      ctx.fill();
      ctx.drawImage(img, 160, 130, 280, 280);
      const a = document.createElement('a');
      a.download = `SeatFinderSRM-${seatId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch { toast({ variant: 'destructive', title: 'Download failed' }); }
  };

  if (loading && !seat) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/seats')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Seats
        </Button>
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">Seat not found</p>
          <p className="text-sm text-muted-foreground mt-1">This seat doesn't exist in our system.</p>
        </div>
      </div>
    );
  }

  if (seat.status !== 'available' && (!booking || booking.seatId !== seat.id)) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/seats')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Seats
        </Button>
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium capitalize">Seat {seat.status}</p>
          <p className="text-sm text-muted-foreground mt-1">This seat is currently unavailable. Please select another.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/seats')}>Browse Seats</Button>
        </div>
      </div>
    );
  }

  const bookingId = booking ? ((booking as any).bookingId ?? booking.id) : null;
  const isMine = booking?.seatId === seatId;
  const mins = Math.floor(countdown / 60);
  const secs = Math.round(countdown % 60).toString().padStart(2, '0');
  const isUrgent = countdown > 0 && countdown <= 60;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/seats')} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Seats
      </Button>

      {/* Active / checked-in state */}
      {isMine && booking?.status === 'active' && (
        <div className="rounded-xl border bg-green-500/8 border-green-500/20 p-6 text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-green-500/15 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">Checked In</p>
            <p className="text-2xl font-bold font-mono mt-1">Seat {seatId}</p>
            {booking.entryTime && (
              <p className="text-sm text-muted-foreground mt-1">
                Since {new Date(booking.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Enjoy your study session!</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => router.push('/scanner')}>
              <QrCode className="h-4 w-4" /> Scanner
            </Button>
          </div>
        </div>
      )}

      {/* Pending booking — show QR */}
      {isMine && booking?.status === 'pending' && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Booked</p>
              <p className="text-xl font-bold font-mono">Seat {seatId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Check in within</p>
              <p className={`text-2xl font-mono font-bold ${isUrgent ? 'text-destructive' : ''}`}>
                {mins}:{secs}
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl border shadow-sm">
              <QRCode
                value={JSON.stringify({ bookingId, userId: user?.uid, seatId })}
                size={200}
              />
            </div>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Scan at the library entrance to check in
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => router.push('/scanner')} className="gap-1.5">
              <QrCode className="h-4 w-4" /> Scanner
            </Button>
            <Button variant="outline" onClick={downloadQR} className="gap-1.5">
              <Download className="h-4 w-4" /> Save QR
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel booking
          </Button>
        </div>
      )}

      {/* Booking form */}
      {!booking && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          {/* Seat info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary font-mono">{seatId.slice(0, 3)}</span>
            </div>
            <div>
              <p className="font-semibold">Seat {seatId}</p>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available</p>
            </div>
          </div>

          {/* End time picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Until when?</label>
            <Select onValueChange={setEndTime} value={endTime}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt.split('|')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {endTime && (
              <p className="text-xs text-muted-foreground">
                Your session ends at <span className="font-medium">{endTime.split('|')[0]}</span>
              </p>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>After booking, you have <strong className="text-foreground">5 minutes</strong> to scan the QR code at the entrance.</span>
          </div>

          <Button
            onClick={handleBooking}
            disabled={loading || !endTime}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            {loading ? 'Booking…' : 'Confirm Booking'}
          </Button>
        </div>
      )}
    </div>
  );
}
