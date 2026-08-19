import { SeatMap } from "@/components/seat-map";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: 'Library Seats',
  description: 'Browse and book available library seats in real-time. View seat availability across all floors with interactive seat map.',
  keywords: ['seat map', 'book seat', 'library availability', 'real-time seats'],
});

export default function SeatsPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-headline">Library Seats</h1>
        <p className="text-muted-foreground mt-1 text-sm">Select a floor and tap an available seat to book</p>
      </div>
      <SeatMap />
    </div>
  );
}
