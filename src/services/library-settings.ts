import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { LibrarySettings, OperatingHours, Holiday, BookingRules } from "@/types";

const SETTINGS_KEY = "library_settings";

export async function getLibrarySettings(): Promise<LibrarySettings | null> {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.SETTINGS, Key: { settingKey: SETTINGS_KEY } })
    );
    return Item ? (Item.value as LibrarySettings) : null;
  } catch {
    return null;
  }
}

async function saveSettings(settings: LibrarySettings): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.SETTINGS,
      Item: { settingKey: SETTINGS_KEY, value: settings, updatedAt: new Date().toISOString() },
    })
  );
}

export async function updateLibrarySettings(settings: LibrarySettings, adminId: string): Promise<void> {
  settings.updatedBy = adminId;
  settings.updatedAt = new Date().toISOString();
  await saveSettings(settings);
}

export async function updateOperatingHours(
  operatingHours: OperatingHours,
  adminId: string
): Promise<{ affectedBookings: string[] }> {
  const current = await getLibrarySettings();
  if (!current) throw new Error("Settings not initialized");
  await saveSettings({ ...current, operatingHours, updatedBy: adminId, updatedAt: new Date().toISOString() });
  return { affectedBookings: [] }; // Actual affected booking computation happens in admin UI
}

export async function addHoliday(holiday: Holiday, adminId: string): Promise<void> {
  const current = await getLibrarySettings();
  if (!current) throw new Error("Settings not initialized");
  if (!current.holidays.some((h) => h.date === holiday.date)) {
    await saveSettings({
      ...current,
      holidays: [...current.holidays, holiday],
      updatedBy: adminId,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function removeHoliday(date: string, adminId: string): Promise<void> {
  const current = await getLibrarySettings();
  if (!current) throw new Error("Settings not initialized");
  await saveSettings({
    ...current,
    holidays: current.holidays.filter((h) => h.date !== date),
    updatedBy: adminId,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateBookingRules(rules: BookingRules, adminId: string): Promise<void> {
  const current = await getLibrarySettings();
  if (!current) throw new Error("Settings not initialized");
  await saveSettings({ ...current, bookingRules: rules, updatedBy: adminId, updatedAt: new Date().toISOString() });
}

export async function isWithinOperatingHours(time: Date): Promise<boolean> {
  const settings = await getLibrarySettings();
  if (!settings) return true;
  const day = time.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const hours = settings.operatingHours[day];
  if (!hours || hours.isClosed) return false;
  const t = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
  return t >= hours.open && t < hours.close;
}

export async function isHoliday(date: Date): Promise<boolean> {
  const settings = await getLibrarySettings();
  if (!settings) return false;
  const dateStr = date.toISOString().split("T")[0];
  return settings.holidays.some((h) => h.date === dateStr);
}

export async function validateBookingTime(
  startTime: Date,
  endTime: Date
): Promise<{ valid: boolean; reason?: string }> {
  if (await isHoliday(startTime)) return { valid: false, reason: "Library is closed on this date (holiday)" };
  if (!(await isWithinOperatingHours(startTime))) return { valid: false, reason: "Booking time is outside operating hours" };
  if (!(await isWithinOperatingHours(endTime))) return { valid: false, reason: "Booking end time is outside operating hours" };
  return { valid: true };
}
