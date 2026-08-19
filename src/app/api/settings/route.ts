import { NextResponse } from "next/server";
import { getLibrarySettings } from "@/services/library-settings";

// Public — no auth required. Returns today's operating hours for UI display.
export async function GET() {
  try {
    const settings = await getLibrarySettings();
    if (!settings) {
      return NextResponse.json({ isOpen: true, message: "Settings not configured" });
    }

    const now = new Date();
    const day = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const todayHours = settings.operatingHours[day];

    if (!todayHours || todayHours.isClosed) {
      return NextResponse.json({ isOpen: false, todayHours: todayHours ?? null });
    }

    const t = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const isOpen = t >= todayHours.open && t < todayHours.close;

    // Check holiday
    const dateStr = now.toISOString().split("T")[0];
    const isHoliday = settings.holidays.some((h) => h.date === dateStr);

    return NextResponse.json({
      isOpen: isOpen && !isHoliday,
      todayHours,
      isHoliday,
      holidayName: isHoliday ? settings.holidays.find((h) => h.date === dateStr)?.name : undefined,
    });
  } catch {
    return NextResponse.json({ isOpen: true });
  }
}
