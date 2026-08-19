'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileText } from 'lucide-react';
import { format as formatDate } from 'date-fns';

export default function ReportsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [groupBy, setGroupBy] = useState('day');
  const [exportFormat, setExportFormat] = useState('csv');
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/bookings', {
        headers: { Authorization: `Bearer ${user?.accessToken ?? ''}` },
      });
      const data = await res.json();
      const allBookings: any[] = (data.bookings ?? []).filter((b: any) => {
        const d = new Date(b.startTime || b.bookingTime);
        return d >= startDate && d <= endDate;
      });

      if (exportFormat === 'csv') {
        const headers = ['Date', 'Seat ID', 'User', 'Status', 'Duration (min)', 'Entry Time', 'Exit Time'];
        const rows = allBookings.map((b) => [
          new Date(b.bookingTime || b.startTime).toLocaleDateString(),
          b.seatId,
          b.userEmail?.split('@')[0] || 'Unknown',
          b.status,
          b.duration || 0,
          b.entryTime ? new Date(b.entryTime).toLocaleString() : 'N/A',
          b.exitTime ? new Date(b.exitTime).toLocaleString() : 'N/A',
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seatfinder-report-${formatDate(startDate, 'yyyy-MM-dd')}-to-${formatDate(endDate, 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`${exportFormat.toUpperCase()} export is not yet implemented.`);
      }
    } catch {
      console.error('Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  const dayDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Export booking data for any date range</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg p-2 bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Generate Report</CardTitle>
              <CardDescription>Select range and format</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 font-normal">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatDate(startDate, 'MMM d, yyyy')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 font-normal">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatDate(endDate, 'MMM d, yyyy')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            {dayDiff} day{dayDiff !== 1 ? 's' : ''} selected
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Group By</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerateReport} className="w-full gap-2" disabled={generating}>
            <Download className="h-4 w-4" />
            {generating ? 'Generating…' : 'Download Report'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
