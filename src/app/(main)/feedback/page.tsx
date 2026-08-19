'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackHistory } from '@/components/feedback-history';

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState('submit');

  const handleSubmitSuccess = () => {
    setActiveTab('history');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feedback & Support</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Report issues or request features — we read every ticket</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
          <TabsTrigger value="history">My Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="mt-6">
          <FeedbackForm onSubmitSuccess={handleSubmitSuccess} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <FeedbackHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
