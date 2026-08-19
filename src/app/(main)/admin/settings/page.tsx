'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, CalendarOff, Plus, Trash2, Save } from 'lucide-react';
import type { LibrarySettings, OperatingHours } from '@/types';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DEFAULT_HOURS: OperatingHours = {
  monday:    { open: '09:00', close: '20:00', isClosed: false },
  tuesday:   { open: '09:00', close: '20:00', isClosed: false },
  wednesday: { open: '09:00', close: '20:00', isClosed: false },
  thursday:  { open: '09:00', close: '20:00', isClosed: false },
  friday:    { open: '09:00', close: '20:00', isClosed: false },
  saturday:  { open: '09:00', close: '17:00', isClosed: false },
  sunday:    { open: '00:00', close: '00:00', isClosed: true  },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data.settings);
      setHours(data.settings.operatingHours ?? DEFAULT_HOURS);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      const payload: LibrarySettings = {
        ...settings,
        operatingHours: hours,
      };
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSettings(payload);
      toast({ title: 'Settings saved', description: 'Operating hours updated successfully.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to save', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate || !newHolidayName || !settings || !user) return;
    const updated: LibrarySettings = {
      ...settings,
      operatingHours: hours,
      holidays: [
        ...settings.holidays.filter((h) => h.date !== newHolidayDate),
        { date: newHolidayDate, name: newHolidayName },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ settings: updated }),
      });
      if (!res.ok) throw new Error();
      setSettings(updated);
      setNewHolidayDate('');
      setNewHolidayName('');
      toast({ title: 'Holiday added' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to add holiday' });
    } finally {
      setSaving(false);
    }
  };

  const removeHoliday = async (date: string) => {
    if (!settings || !user) return;
    const updated: LibrarySettings = {
      ...settings,
      operatingHours: hours,
      holidays: settings.holidays.filter((h) => h.date !== date),
    };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ settings: updated }),
      });
      if (!res.ok) throw new Error();
      setSettings(updated);
      toast({ title: 'Holiday removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove holiday' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Card><CardContent className="pt-6 space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-headline">Library Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure operating hours and holidays. Bookings outside these hours will be blocked.
        </p>
        {settings?.updatedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Last updated {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Operating Hours */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Operating Hours</CardTitle>
          </div>
          <CardDescription>Set the open and close times for each day of the week.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const h = hours[day] ?? { open: '09:00', close: '20:00', isClosed: false };
            return (
              <div key={day} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-28 flex items-center gap-2">
                  <Switch
                    checked={!h.isClosed}
                    onCheckedChange={(checked) =>
                      setHours((prev) => ({ ...prev, [day]: { ...h, isClosed: !checked } }))
                    }
                    id={`switch-${day}`}
                  />
                  <label htmlFor={`switch-${day}`} className="text-sm font-medium cursor-pointer select-none">
                    {DAY_LABELS[day].slice(0, 3)}
                  </label>
                </div>

                {h.isClosed ? (
                  <div className="flex-1 flex items-center">
                    <Badge variant="secondary" className="text-xs">Closed</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={h.open}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day]: { ...h, open: e.target.value } }))
                      }
                      className="h-9 w-32 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      value={h.close}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day]: { ...h, close: e.target.value } }))
                      }
                      className="h-9 w-32 text-sm"
                    />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      ({h.open} – {h.close})
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Operating Hours'}
          </Button>
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Holidays & Closures</CardTitle>
          </div>
          <CardDescription>
            Library will be marked closed on these dates regardless of operating hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add holiday */}
          <div className="flex gap-2 flex-col sm:flex-row">
            <Input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="h-9 w-full sm:w-40 text-sm"
            />
            <Input
              placeholder="Holiday name (e.g. Diwali)"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              className="h-9 flex-1 text-sm"
            />
            <Button
              onClick={addHoliday}
              disabled={saving || !newHolidayDate || !newHolidayName}
              size="sm"
              className="h-9 shrink-0"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Add
            </Button>
          </div>

          {/* Holiday list */}
          {settings?.holidays && settings.holidays.length > 0 ? (
            <div className="space-y-2">
              {settings.holidays.map((holiday) => (
                <div key={holiday.date} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 border">
                  <div>
                    <span className="font-medium text-sm">{holiday.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(holiday.date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeHoliday(holiday.date)}
                    disabled={saving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No holidays configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
