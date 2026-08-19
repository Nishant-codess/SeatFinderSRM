'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Flag, FlagOff, Users, RefreshCw, ShieldAlert } from 'lucide-react';

export default function UsersPage() {
  const { user: admin } = useAuth();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${admin?.accessToken ?? ''}` },
      });
      const data = await res.json();
      setAllUsers(data.users ?? []);
    } catch {
      console.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleFlagUser = async (userId: string) => {
    try {
      await fetch('/api/admin/users/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin?.accessToken ?? ''}` },
        body: JSON.stringify({ userId, reason }),
      });
      fetchUsers();
      setReason('');
    } catch { console.error('Error flagging user'); }
  };

  const handleUnflagUser = async (userId: string) => {
    try {
      await fetch('/api/admin/users/unflag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin?.accessToken ?? ''}` },
        body: JSON.stringify({ userId }),
      });
      fetchUsers();
    } catch { console.error('Error unflagging user'); }
  };

  const filtered = allUsers.filter((u) =>
    !searchQuery.trim() ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.displayName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const flaggedCount = allUsers.filter((u) => u.restrictions?.isFlagged).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allUsers.length} registered · {flaggedCount} flagged
          </p>
        </div>
        <Button onClick={fetchUsers} disabled={loading} size="sm" variant="outline" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Users', value: allUsers.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Active', value: allUsers.length - flaggedCount, icon: Users, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Flagged', value: flaggedCount, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No users found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-medium">User</TableHead>
                <TableHead className="font-medium">Bookings</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const uid = u.userId ?? u.uid;
                const isFlagged = u.restrictions?.isFlagged;
                return (
                  <TableRow key={uid} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium">
                            {(u.email ?? 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.displayName || u.email?.split('@')[0] || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{u.stats?.totalBookings ?? 0}</span>
                    </TableCell>
                    <TableCell>
                      {isFlagged ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                          <ShieldAlert className="h-3 w-3" /> Flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" /> Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isFlagged ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleUnflagUser(uid)}>
                          <FlagOff className="h-3 w-3" /> Unflag
                        </Button>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Flag className="h-3 w-3" /> Flag
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Flag User</DialogTitle>
                              <DialogDescription>
                                Flagging <strong>{u.email}</strong> will restrict them from making new bookings.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label>Reason</Label>
                              <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Describe why this user is being flagged…"
                                className="resize-none"
                                rows={3}
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="destructive" onClick={() => handleFlagUser(uid)} disabled={!reason.trim()}>
                                Flag User
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
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
