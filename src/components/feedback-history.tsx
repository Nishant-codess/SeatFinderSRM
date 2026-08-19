'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Clock, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';
import type { FeedbackTicket, FeedbackStatus } from '@/types';

const STATUS_STYLES: Record<FeedbackStatus | string, { label: string; class: string }> = {
  open:        { label: 'Open',        class: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  pending:     { label: 'Pending',     class: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' },
  'in-progress':{ label: 'In Progress', class: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  resolved:    { label: 'Resolved',    class: 'text-green-600 dark:text-green-400 bg-green-500/10' },
  closed:      { label: 'Closed',      class: 'text-muted-foreground bg-muted' },
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug', 'feature-request': 'Feature', 'seat-issue': 'Seat Issue', general: 'General',
};

function TicketRow({ ticket }: { ticket: FeedbackTicket }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open;

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', style.class)}>
              {style.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            </span>
            {(ticket.responses?.length ?? 0) > 0 && (
              <span className="text-xs text-primary font-medium">
                {ticket.responses!.length} reply
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-1">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-3 bg-muted/10">
          <p className="text-sm text-muted-foreground">{ticket.description}</p>

          {ticket.responses && ticket.responses.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responses</p>
              {ticket.responses.map((r: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg p-3 text-sm',
                    r.isAdmin ? 'bg-primary/8 border border-primary/15 ml-4' : 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{r.isAdmin ? 'Support' : 'You'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.respondedAt || r.timestamp || Date.now()).toLocaleString('en-IN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p>{r.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FeedbackHistory() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch(`/api/feedback/user/${user.uid}`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
        <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-muted-foreground">No tickets yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Submit feedback above to get started</p>
      </div>
    );
  }

  const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
        {resolved > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" /> {resolved} resolved
          </span>
        )}
      </div>
      {tickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
    </div>
  );
}
