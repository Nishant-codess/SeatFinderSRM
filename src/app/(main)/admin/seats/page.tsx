'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RefreshCw, Armchair, Wrench, CheckCircle2, Circle } from 'lucide-react';
import type { Seat } from '@/types';

const STATUS_STYLES: Record<string, { ring: string; bg: string; dot: string; label: string }> = {
  available:       { ring: 'ring-green-500/40',  bg: 'bg-green-500/10 hover:bg-green-500/20',   dot: 'bg-green-500',  label: 'Available' },
  reserved:        { ring: 'ring-blue-500/40',   bg: 'bg-blue-500/10 hover:bg-blue-500/20',    dot: 'bg-blue-500',   label: 'Reserved' },
  occupied:        { ring: 'ring-yellow-500/40', bg: 'bg-yellow-500/10 hover:bg-yellow-500/20', dot: 'bg-yellow-500', label: 'Occupied' },
  maintenance:     { ring: 'ring-orange-500/40', bg: 'bg-orange-500/10 hover:bg-orange-500/20', dot: 'bg-orange-500', label: 'Maintenance' },
  'out-of-service':{ ring: 'ring-red-500/40',    bg: 'bg-red-500/10 hover:bg-red-500/20',      dot: 'bg-red-500',    label: 'Out of Service' },
};

const FLOOR_LABELS: Record<string, string> = {
  ground: 'Ground Floor', first: 'First Floor', second: 'Second Floor', third: 'Third Floor',
};

export default function SeatsPage() {
  const { user: admin } = useAuth();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [expectedRestoration, setExpectedRestoration] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { fetchSeats(); }, []);

  const fetchSeats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seats');
      const data = await res.json();
      const floorMap: Record<string, any> = data.seats ?? {};
      const flat: Seat[] = [];
      Object.values(floorMap).forEach((floorSeats: any) => {
        Object.values(floorSeats).forEach((seat: any) =>
          flat.push({ ...seat, id: seat.seatId ?? seat.id } as Seat)
        );
      });
      setSeats(flat);
    } catch {
      console.error('Error fetching seats');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkMaintenance = async (seatId: string, action: string) => {
    try {
      await fetch('/api/admin/seats/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin?.accessToken ?? ''}` },
        body: JSON.stringify({
          seatId,
          action,
          maintenanceInfo: action !== 'restore' ? {
            reason: maintenanceReason,
            reportedBy: admin?.email ?? 'admin',
            expectedRestoration,
            startedAt: new Date().toISOString(),
          } : undefined,
        }),
      });
      await fetchSeats();
      setDialogOpen(false);
      setMaintenanceReason('');
      setExpectedRestoration('');
      setSelectedSeat(null);
    } catch {
      console.error('Error updating seat');
    }
  };

  const seatsByFloor = seats.reduce((acc, seat) => {
    const prefix = seat.id.charAt(0).toUpperCase();
    const floorMap: Record<string, string> = { G: 'ground', F: 'first', S: 'second', T: 'third' };
    const key = floorMap[prefix] ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

  const floorOrder = ['ground', 'first', 'second', 'third'];

  const statusSummary = {
    available: seats.filter((s) => s.status === 'available').length,
    occupied: seats.filter((s) => s.status === 'occupied' || s.status === 'reserved').length,
    maintenance: seats.filter((s) => s.status === 'maintenance' || s.status === 'out-of-service').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seat Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{seats.length} seats total</p>
        </div>
        <Button onClick={fetchSeats} disabled={loading} size="sm" variant="outline" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {seats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Available', value: statusSummary.available, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'In Use', value: statusSummary.occupied, icon: Armchair, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Maintenance', value: statusSummary.maintenance, icon: Wrench, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_STYLES).map(([key, { dot, label }]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
        </div>
      ) : seats.length === 0 ? (
        <div className="rounded-lg border border-dashed flex flex-col items-center justify-center py-16">
          <Armchair className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No seats found</p>
        </div>
      ) : (
        floorOrder
          .filter((floor) => seatsByFloor[floor]?.length > 0)
          .map((floor) => (
            <Card key={floor}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{FLOOR_LABELS[floor]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {seatsByFloor[floor]
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((seat) => {
                      const style = STATUS_STYLES[seat.status] ?? STATUS_STYLES.available;
                      return (
                        <Dialog
                          key={seat.id}
                          open={dialogOpen && selectedSeat?.id === seat.id}
                          onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) { setSelectedSeat(null); setMaintenanceReason(''); setExpectedRestoration(''); }
                          }}
                        >
                          <DialogTrigger asChild>
                            <button
                              onClick={() => { setSelectedSeat(seat); setDialogOpen(true); }}
                              className={`rounded-lg p-2 ring-1 text-center transition-all cursor-pointer ${style.ring} ${style.bg}`}
                            >
                              <p className="text-xs font-bold">{seat.id}</p>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mt-1 ${style.dot}`} />
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Seat {seat.id}</DialogTitle>
                              <DialogDescription>
                                Current status: <strong className="capitalize">{seat.status}</strong>
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                              <div className="space-y-1.5">
                                <Label>Maintenance Reason</Label>
                                <Textarea
                                  value={maintenanceReason}
                                  onChange={(e) => setMaintenanceReason(e.target.value)}
                                  placeholder="Describe the issue…"
                                  className="resize-none"
                                  rows={3}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Restoration Date</Label>
                                  <Input
                                    type="date"
                                    value={expectedRestoration.split('T')[0] || ''}
                                    onChange={(e) => {
                                      const time = expectedRestoration.split('T')[1] || '09:00';
                                      setExpectedRestoration(`${e.target.value}T${time}`);
                                    }}
                                    min={new Date().toISOString().split('T')[0]}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Restoration Time</Label>
                                  <Input
                                    type="time"
                                    value={expectedRestoration.split('T')[1] || '09:00'}
                                    onChange={(e) => {
                                      const date = expectedRestoration.split('T')[0] || new Date().toISOString().split('T')[0];
                                      setExpectedRestoration(`${date}T${e.target.value}`);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleMarkMaintenance(seat.id, 'maintenance')}
                                disabled={!maintenanceReason || !expectedRestoration}
                                className="gap-1.5"
                              >
                                <Wrench className="h-3.5 w-3.5" /> Mark Maintenance
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleMarkMaintenance(seat.id, 'out-of-service')}
                                disabled={!maintenanceReason || !expectedRestoration}
                              >
                                Out of Service
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkMaintenance(seat.id, 'restore')}
                                className="gap-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Restore
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
