'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';
import type { FeedbackCategory } from '@/types';

interface FeedbackFormProps {
  onSubmitSuccess?: () => void;
}

export function FeedbackForm({ onSubmitSuccess }: FeedbackFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '' as FeedbackCategory | '',
    subject: '',
    description: '',
  });

  const categories: Array<{ value: FeedbackCategory; label: string }> = [
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature-request', label: 'Feature Request' },
    { value: 'seat-issue', label: 'Seat Issue' },
    { value: 'general', label: 'General Feedback' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.category || !formData.subject || !formData.description) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill in all required fields.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.accessToken}` },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.email?.split('@')[0] || 'User',
          userEmail: user.email || '',
          ...formData,
          attachments: [],
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit');

      toast({ title: 'Feedback Submitted', description: 'Thank you! We will review it shortly.' });
      setFormData({ category: '', subject: '', description: '' });
      onSubmitSuccess?.();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Feedback</CardTitle>
        <CardDescription>Report issues, request features, or share your thoughts</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as FeedbackCategory })}>
              <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input id="subject" placeholder="Brief description" value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" placeholder="Detailed information" value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={6} maxLength={1000} />
            <p className="text-xs text-muted-foreground">{formData.description.length}/1000 characters</p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <><Send className="mr-2 h-4 w-4" />Submit Feedback</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
