// Seat Types
export type SeatStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'out-of-service';

export interface MaintenanceInfo {
  reason: string;
  reportedBy: string;
  expectedRestoration?: string;
  startedAt: string;
}

export interface Seat {
  id: string;
  number: string;
  section: string;
  floor: string;
  status: SeatStatus;
  bookedBy: string | null;
  bookedAt: number | null;
  bookingId: string | null;
  occupiedUntil?: number | null;
  maintenanceInfo?: MaintenanceInfo;
}

// Booking Types
export type BookingStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'no-show' | 'expired';

export interface Booking {
  id: string;
  bookingId?: string; // DynamoDB sort key alias
  seatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  bookingTime: string; // ISO timestamp
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  entryTime?: string; // ISO timestamp
  exitTime?: string; // ISO timestamp
  status: BookingStatus;
  duration: number; // Duration in minutes
  extendedFrom?: string; // Original end time if extended
  cancelledBy?: string; // Admin ID if cancelled by admin
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

// User Types
export type UserRole = 'user' | 'admin';

export interface UserRestrictions {
  isFlagged: boolean;
  reason?: string;
  flaggedBy?: string;
  flaggedAt?: string;
}

export interface UserStats {
  totalBookings: number;
  noShowCount: number;
  overstayCount: number;
  totalHoursBooked: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  currentBookingId?: string;
  restrictions?: UserRestrictions;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

// Analytics Types
export interface PeakHour {
  hour: number;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  occupancyRate: number; // Percentage
  peakHours: PeakHour[];
  averageDuration: number; // Minutes
  noShowRate: number; // Percentage
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface UsageTrend {
  date: string;
  bookings: number;
  occupancyRate: number;
  averageDuration: number;
}

// Feedback Types
export type FeedbackCategory = 'bug' | 'feature-request' | 'seat-issue' | 'general';
export type FeedbackStatus = 'pending' | 'in-progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'medium' | 'high';

export interface FeedbackResponse {
  id?: string;
  authorId?: string;
  authorName?: string;
  message: string;
  timestamp?: string;
  respondedBy?: string;
  respondedAt?: string;
  isAdmin?: boolean;
}

export interface FeedbackTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: FeedbackCategory;
  subject: string;
  description: string;
  attachments?: string[]; // URLs to uploaded files
  status: FeedbackStatus;
  priority?: FeedbackPriority;
  assignedTo?: string; // Admin ID
  responses: FeedbackResponse[];
  createdAt: string;
  updatedAt: string;
}

// Library Settings Types
export interface OperatingHours {
  [day: string]: { // 'monday', 'tuesday', etc.
    open: string; // HH:mm format
    close: string; // HH:mm format
    isClosed: boolean;
  };
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface BookingRules {
  maxDailyDuration: number; // Minutes
  maxAdvanceBookingDays: number;
  minBookingDuration: number;
  maxBookingDuration: number;
  extensionIncrement: number; // Minutes
}

export interface LibrarySettings {
  operatingHours: OperatingHours;
  holidays: Holiday[];
  bookingRules: BookingRules;
  updatedBy: string;
  updatedAt: string;
}

// Filter Types
export interface BookingFilters {
  userId?: string;
  seatId?: string;
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface FeedbackFilters {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
}

// Report Types
export type ReportMetric = 'occupancy' | 'no-show-rate' | 'average-duration' | 'user-activity';
export type ReportFormat = 'csv' | 'pdf' | 'excel';
export type ReportGroupBy = 'day' | 'week' | 'month';

export interface ReportConfig {
  metrics: ReportMetric[];
  dateRange: { start: Date; end: Date };
  filters?: {
    section?: string;
    userGroup?: string;
  };
  groupBy?: ReportGroupBy;
}

export interface ReportData {
  title: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  summary: Record<string, number | string>;
  data: Array<Record<string, any>>;
  charts?: Array<{ type: string; data: any }>;
}

// User Statistics Types
export interface UserStatistics {
  totalBookings: number;
  totalHoursBooked: number;
  averageSessionDuration: number;
  noShowCount: number;
  overstayCount: number;
  mostBookedSeats: Array<{ seatId: string; count: number }>;
  preferredTimeSlots: Array<{ hour: number; count: number }>;
  weeklyUsage: Array<{ week: string; hours: number }>;
  monthlyUsage: Array<{ month: string; hours: number }>;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  action: string;
  targetId: string;
  targetType: 'booking' | 'user' | 'seat' | 'settings';
  reason?: string;
  details?: Record<string, any>;
}

// Booking Extension Types
export interface ExtensionResult {
  success: boolean;
  newEndTime?: string;
  alternatives?: Seat[];
  message?: string;
}
