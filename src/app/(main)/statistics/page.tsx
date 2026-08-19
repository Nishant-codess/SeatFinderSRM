import { UsageStatistics } from '@/components/usage-statistics';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Usage Statistics',
  description: 'View your library usage statistics, booking history, and study patterns. Track total hours spent and booking trends.',
  keywords: ['usage stats', 'booking history', 'study hours', 'analytics'],
});

export default function StatisticsPage() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Statistics</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Your booking history and usage patterns</p>
      </div>

      <UsageStatistics />
    </div>
  );
}
