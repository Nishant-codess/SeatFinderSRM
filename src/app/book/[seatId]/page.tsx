
"use client";

import { BookingClient } from "@/components/booking-client";
import { useAuth } from "@/components/providers/auth-provider";
import { Booking } from "@/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function BookSeatPage({ params }: { params: Promise<{ seatId: string }> }) {
  const { user, loading: authLoading } = useAuth();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [seatId, setSeatId] = useState<string>("");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    params.then((p) => setSeatId(p.seatId));
  }, [params]);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }

    fetch("/api/bookings/active", {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const booking: Booking | null = data.booking ?? null;
        setActiveBooking(booking);

        if (booking && seatId && booking.seatId !== seatId) {
          toast({
            variant: "destructive",
            title: "Active Booking Exists",
            description: `You already have an active booking for seat ${booking.seatId}. Cancel it first.`,
          });
          router.push(`/book/${booking.seatId}`);
        }
      })
      .catch(() => setActiveBooking(null))
      .finally(() => setLoading(false));
  }, [user, authLoading, seatId, router, toast]);

  if (authLoading || loading || !seatId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4">
      <BookingClient seatId={seatId} activeBooking={activeBooking} />
    </div>
  );
}
