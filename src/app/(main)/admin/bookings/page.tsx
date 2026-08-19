'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, XCircle, LogIn, LogOut, RefreshCw, Calendar } from 'lucide-react';
import type { Booking } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
  pending:   'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  expired:   'bg-muted text-muted-foreground border-border',
};

const FILTERS = ['all', 'active', 'pending', 'completed', 'cancelled'] as const;

export default function BookingsPage() {
  const { user: admin } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [actionReason, setActionReason] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bookings', {
        headers: { Authorization: `Bearer ${admin?.accessToken ?? ''}` },
      });
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch {
      console.error('Error fetching bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const action = async (endpoint: string, bookingId: string) => {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin?.accessToken ?? ''}` },
        body: JSON.stringify({ bookingId, reason: actionReason }),
      });
      fetchBookings();
      setActionReason('');
    } catch {
      console.error('Error with booking action');
    }
  };

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      b.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.seatId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || b.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? bookings.length : bookings.filter((b) => b.status === f).length;
    return acc;
  }, {} as Record<string, number>);

  const fmtDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{bookings.length} total bookings</p>
        </div>
        <Button onClick={fetchBookings} disabled={loading} size="sm" variant="outline" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search + filter */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search user, email, seat…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                activeFilter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f} {counts[f] > 0 && <span className="opacity-70">({counts[f]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No bookings found</p>
            {searchTerm && <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-medium">User</TableHead>
                <TableHead className="font-medium">Seat</TableHead>
                <TableHead className="font-medium">Start</TableHead>
                <TableHead className="font-medium">End</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((booking) => {
                const bookingId = (booking as any).bookingId ?? booking.id;
                const key = bookingId ?? `${booking.userEmail}-${booking.seatId}`;
                const userName = booking.userName || booking.userEmail?.split('@')[0] || 'Unknown';
                return (
                  <TableRow key={key} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{userName}</p>
                        <p className="text-xs text-muted-foreground">{booking.userEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{booking.seatId}</span>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(booking.entryTime || booking.startTime || booking.bookingTime)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(booking.exitTime || booking.endTime)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[booking.status] ?? STATUS_COLORS.expired}`}>
                        {booking.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Check In">
                              <LogIn className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Manual Check-In</DialogTitle>
                              <DialogDescription>Force check-in for <strong>{userName}</strong> at seat <strong>{booking.seatId}</strong></DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label>Reason</Label>
                              <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Reason for manual check-in…" className="resize-none" rows={3} />
                            </div>
                            <DialogFooter>
                              <Button onClick={() => action('/api/admin/bookings/check-in', bookingId)}>Confirm Check-In</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Check Out">
                              <LogOut className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Manual Check-Out</DialogTitle>
                              <DialogDescription>Force check-out for <strong>{userName}</strong></DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label>Reason</Label>
                              <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Reason for manual check-out…" className="resize-none" rows={3} />
                            </div>
                            <DialogFooter>
                              <Button onClick={() => action('/api/admin/bookings/check-out', bookingId)}>Confirm Check-Out</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" title="Cancel">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Cancel Booking</DialogTitle>
                              <DialogDescription>This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label>Reason</Label>
                              <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Reason for cancellation…" className="resize-none" rows={3} />
                            </div>
                            <DialogFooter>
                              <Button variant="destructive" onClick={() => action('/api/admin/bookings/cancel', bookingId)}>Cancel Booking</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
