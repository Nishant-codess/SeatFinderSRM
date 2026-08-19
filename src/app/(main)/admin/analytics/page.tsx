'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { BarChart } from '@/components/charts/bar-chart';
import { CircularProgress } from '@/components/charts/circular-progress';
import { LineChart } from '@/components/charts/line-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, TrendingUp, Users, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;
    if (date > new Date()) {
      toast({ variant: 'destructive', title: 'Invalid Date', description: 'Cannot select future dates' });
      return;
    }
    if (date > endDate) setEndDate(date);
    setStartDate(date);
    setStartDateOpen(false);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (!date) return;
    if (date > new Date()) {
      toast({ variant: 'destructive', title: 'Invalid Date', description: 'Cannot select future dates' });
      return;
    }
    if (date < startDate) {
      toast({ variant: 'destructive', title: 'Invalid Range', description: 'End date must be after start date' });
      return;
    }
    setEndDate(date);
    setEndDateOpen(false);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        granularity: 'daily',
      });
      const res = await fetch(`/api/admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${user?.accessToken ?? ''}` },
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      const raw = data.analytics ?? null;
      if (raw) {
        raw.peakHours = (raw.peakHours ?? []).map((p: any) => ({ ...p, hour: `${p.hour}:00` }));
      }
      setAnalytics(raw);
      setTrends(data.trends ?? null);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load analytics' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [startDate, endDate]);

  const statCards = analytics ? [
    {
      label: 'Total Bookings',
      value: analytics.totalBookings,
      sub: `${analytics.activeBookings ?? 0} currently active`,
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Active Now',
      value: analytics.activeBookings ?? 0,
      sub: 'Seats in use',
      icon: Users,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Avg Duration',
      value: `${Math.round(analytics.averageDuration)}m`,
      sub: 'Per booking session',
      icon: Clock,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'No-Show Rate',
      value: `${Math.round(analytics.noShowRate)}%`,
      sub: 'Missed check-ins',
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Library usage insights and trends</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-sm">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(startDate, 'MMM d')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={startDate} onSelect={handleStartDateChange} initialFocus />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-sm">→</span>

          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-sm">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(endDate, 'MMM d')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={endDate} onSelect={handleEndDateChange} initialFocus />
            </PopoverContent>
          </Popover>

          <Button onClick={fetchAnalytics} disabled={loading} size="sm" variant="outline" className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {loading && !analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !analytics && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No data for this period</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Try selecting a different date range</p>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <Card key={label} className="overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                    <div className={cn('rounded-lg p-2.5', bg)}>
                      <Icon className={cn('h-5 w-5', color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Occupancy gauge + peak hours */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <CardDescription>Seat utilization</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <CircularProgress percentage={analytics.occupancyRate} label="Occupancy" color="#3b82f6" />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
                <CardDescription>Busiest times of day</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={analytics.peakHours}
                  xKey="hour"
                  yKey="count"
                  xLabel="Hour"
                  yLabel="Bookings"
                  barColor="#3b82f6"
                />
              </CardContent>
            </Card>
          </div>

          {trends && trends.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Usage Trends</CardTitle>
                <CardDescription>Daily booking patterns over the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={trends}
                  xKey="date"
                  lines={[
                    { key: 'bookings', color: '#3b82f6', label: 'Bookings' },
                    { key: 'occupancyRate', color: '#10b981', label: 'Occupancy %' },
                  ]}
                  xLabel="Date"
                  yLabel="Value"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
