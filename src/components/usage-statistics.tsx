'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/components/charts/bar-chart';
import { LineChart } from '@/components/charts/line-chart';
import { Clock, Calendar, Armchair, TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import type { UserStatistics } from '@/types';

export function UsageStatistics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    fetch(`/api/stats/user/${user.uid}`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setStats(data.statistics ?? null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader><CardTitle>Usage Statistics</CardTitle><CardDescription>No statistics available yet</CardDescription></CardHeader>
        <CardContent><p className="text-muted-foreground text-center py-8">Start booking seats to see your usage statistics</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Bookings', value: stats.totalBookings, sub: 'All time', icon: Calendar },
          { label: 'Total Hours', value: stats.totalHoursBooked.toFixed(1), sub: 'Hours booked', icon: Clock },
          { label: 'Avg Duration', value: Math.round(stats.averageSessionDuration), sub: 'Minutes per session', icon: TrendingUp },
          { label: 'No-Shows', value: stats.noShowCount, sub: 'Missed bookings', icon: Armchair },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-headline">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="font-headline">Most Booked Seats</CardTitle><CardDescription>Your favorite seats</CardDescription></CardHeader>
          <CardContent className="pt-4">
            {stats.mostBookedSeats.length > 0
              ? <BarChart data={stats.mostBookedSeats} xKey="seatId" yKey="count" xLabel="Seat" yLabel="Bookings" barColor="#3b82f6" />
              : <div className="flex flex-col items-center justify-center py-12"><Armchair className="h-12 w-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground text-sm">No data available</p></div>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="font-headline">Preferred Time Slots</CardTitle><CardDescription>When you usually book</CardDescription></CardHeader>
          <CardContent className="pt-4">
            {stats.preferredTimeSlots.length > 0
              ? <BarChart data={stats.preferredTimeSlots} xKey="hour" yKey="count" xLabel="Hour of Day" yLabel="Bookings" barColor="#10b981" />
              : <div className="flex flex-col items-center justify-center py-12"><Clock className="h-12 w-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground text-sm">No data available</p></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="font-headline">Weekly Usage</CardTitle><CardDescription>Hours booked per week</CardDescription></CardHeader>
          <CardContent className="pt-4">
            {stats.weeklyUsage.length > 0
              ? <LineChart data={stats.weeklyUsage} xKey="week" lines={[{ key: 'hours', color: '#3b82f6', label: 'Hours' }]} xLabel="Week" yLabel="Hours" />
              : <div className="flex flex-col items-center justify-center py-12"><Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground text-sm">No data available</p></div>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="font-headline">Monthly Usage</CardTitle><CardDescription>Hours booked per month</CardDescription></CardHeader>
          <CardContent className="pt-4">
            {stats.monthlyUsage.length > 0
              ? <LineChart data={stats.monthlyUsage} xKey="month" lines={[{ key: 'hours', color: '#10b981', label: 'Hours' }]} xLabel="Month" yLabel="Hours" />
              : <div className="flex flex-col items-center justify-center py-12"><TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground text-sm">No data available</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
