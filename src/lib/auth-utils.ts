// FOR TESTS ONLY — this is a mock session store with no connection to real auth.
// Do NOT import from API routes. Use src/lib/verify-admin.ts for production auth.
import { UserProfile, UserRole } from '@/types';

// Mock authentication database
const mockDb = {
  users: new Map<string, { email: string; password: string; profile: UserProfile }>(),
  sessions: new Map<string, { userId: string; expiresAt: number }>(),
};

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Validate input
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required',
    };
  }
  
  // Find user by email
  let foundUser: { email: string; password: string; profile: UserProfile } | undefined;
  
  for (const user of mockDb.users.values()) {
    if (user.email === email) {
      foundUser = user;
      break;
    }
  }
  
  if (!foundUser) {
    return {
      success: false,
      error: 'Invalid credentials',
    };
  }
  
  // Check password
  if (foundUser.password !== password) {
    return {
      success: false,
      error: 'Invalid credentials',
    };
  }
  
  return {
    success: true,
    userId: foundUser.profile.uid,
  };
}

/**
 * Check if user has admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
  for (const user of mockDb.users.values()) {
    if (user.profile.uid === userId) {
      return user.profile.role === 'admin';
    }
  }
  
  return false;
}

/**
 * Check if user has specific role
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  for (const user of mockDb.users.values()) {
    if (user.profile.uid === userId) {
      return user.profile.role === role;
    }
  }
  
  return false;
}

/**
 * Create a session for a user
 */
export async function createSession(
  userId: string,
  durationMinutes: number = 60
): Promise<string> {
  const sessionId = `session-${Date.now()}-${Math.random()}`;
  const expiresAt = Date.now() + durationMinutes * 60000;
  
  mockDb.sessions.set(sessionId, {
    userId,
    expiresAt,
  });
  
  return sessionId;
}

/**
 * Validate a session
 */
export async function validateSession(
  sessionId: string
): Promise<{ valid: boolean; userId?: string; expired?: boolean }> {
  const session = mockDb.sessions.get(sessionId);
  
  if (!session) {
    return { valid: false };
  }
  
  if (Date.now() > session.expiresAt) {
    return { valid: false, expired: true };
  }
  
  return {
    valid: true,
    userId: session.userId,
  };
}

/**
 * Check if user can access admin features
 */
export async function canAccessAdminFeatures(userId: string): Promise<boolean> {
  return isAdmin(userId);
}

/**
 * Verify admin access with session
 */
export async function verifyAdminAccess(
  sessionId: string
): Promise<{ authorized: boolean; userId?: string; reason?: string }> {
  // Validate session
  const sessionValidation = await validateSession(sessionId);
  
  if (!sessionValidation.valid) {
    return {
      authorized: false,
      reason: sessionValidation.expired ? 'Session expired' : 'Invalid session',
    };
  }
  
  // Check if user is admin
  const isUserAdmin = await isAdmin(sessionValidation.userId!);
  
  if (!isUserAdmin) {
    return {
      authorized: false,
      reason: 'Insufficient privileges',
    };
  }
  
  return {
    authorized: true,
    userId: sessionValidation.userId,
  };
}

/**
 * Authenticate admin user
 */
export async function authenticateAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  // Authenticate user
  const authResult = await authenticateUser(email, password);
  
  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    };
  }
  
  // Check if user is admin
  const isUserAdmin = await isAdmin(authResult.userId!);
  
  if (!isUserAdmin) {
    return {
      success: false,
      error: 'Access denied - admin privileges required',
    };
  }
  
  // Create session
  const sessionId = await createSession(authResult.userId!);
  
  return {
    success: true,
    sessionId,
  };
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  mockDb.sessions.delete(sessionId);
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  for (const user of mockDb.users.values()) {
    if (user.profile.uid === userId) {
      return user.profile;
    }
  }
  
  return null;
}

// Test utilities
export const __test__ = {
  addUser: (email: string, password: string, profile: UserProfile) => {
    mockDb.users.set(profile.uid, { email, password, profile });
  },
  getUsers: () => Array.from(mockDb.users.values()),
  getSessions: () => Array.from(mockDb.sessions.values()),
  clear: () => {
    mockDb.users.clear();
    mockDb.sessions.clear();
  },
};
