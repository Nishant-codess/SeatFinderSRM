'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Clock, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface FeedbackTicket {
  id: string;
  userId: string;
  userEmail: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  responses?: Array<{ message: string; respondedBy: string; respondedAt: string; isAdmin: boolean }>;
}

const STATUS_STYLES = {
  open:        { label: 'Open',        icon: XCircle,      class: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  'in-progress':{ label: 'In Progress', icon: Clock,        class: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  resolved:    { label: 'Resolved',    icon: CheckCircle,  class: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20' },
  closed:      { label: 'Closed',      icon: CheckCircle,  class: 'text-muted-foreground bg-muted border-border' },
};

const PRIORITY_STYLES = {
  high:   'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low:    'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const FILTERS = ['all', 'open', 'in-progress', 'resolved', 'closed'] as const;

function TicketCard({ ticket, onUpdate }: { ticket: FeedbackTicket; onUpdate: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [response, setResponse] = useState('');

  const status = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open;
  const StatusIcon = status.icon;

  const handleRespond = async () => {
    if (!response.trim() || !user) return;
    try {
      await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ ticketId: ticket.id, response, adminEmail: user.email }),
      });
      setResponse('');
      onUpdate();
    } catch { console.error('Error responding'); }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.accessToken ?? ''}` },
        body: JSON.stringify({ ticketId: ticket.id, status: newStatus }),
      });
      onUpdate();
    } catch { console.error('Error updating status'); }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${status.class}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
            <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.low}`}>
              {ticket.priority}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">{ticket.category}</span>
          </div>
          <p className="font-medium text-sm mt-1.5">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ticket.userEmail} · {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Description */}
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{ticket.description}</div>

          {/* Responses */}
          {ticket.responses && ticket.responses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Thread ({ticket.responses.length})</p>
              {ticket.responses.map((resp, idx) => (
                <div key={idx} className={`rounded-lg p-3 text-sm ${resp.isAdmin ? 'bg-primary/8 border border-primary/15 ml-4' : 'bg-muted/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{resp.isAdmin ? 'Admin' : 'User'}</span>
                    <span className="text-xs text-muted-foreground">{new Date(resp.respondedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm">{resp.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 items-center pt-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8">
                  <MessageSquare className="h-3.5 w-3.5" /> Respond
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Respond to Ticket</DialogTitle>
                  <DialogDescription>{ticket.subject}</DialogDescription>
                </DialogHeader>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Type your response…"
                  className="resize-none"
                  rows={5}
                />
                <DialogFooter>
                  <Button onClick={handleRespond} disabled={!response.trim()}>Send Response</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchFeedback(); }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        headers: { Authorization: `Bearer ${user?.accessToken ?? ''}` },
      });
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch { console.error('Error fetching feedback'); }
    finally { setLoading(false); }
  };

  const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter);
  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? tickets.length : tickets.filter((t) => t.status === f).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tickets.filter((t) => t.status === 'open').length} open · {tickets.length} total
          </p>
        </div>
        <Button onClick={fetchFeedback} disabled={loading} size="sm" variant="outline" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
              statusFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.replace('-', ' ')} {counts[f] > 0 && <span className="opacity-70">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onUpdate={fetchFeedback} />
          ))}
        </div>
      )}
    </div>
  );
}
