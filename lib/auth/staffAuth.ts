import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { generateSessionToken, hashToken } from './tokenUtils';
import { AppError } from '@/lib/errors';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'administrator' | 'admin' | 'teacher';
  phone?: string;
  status: 'active' | 'inactive';
  failed_login_attempts: number;
  locked_until?: string | Date;
  last_login_at?: string | Date;
  lifecycle_status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export async function loginStaff(
  identifier: string,
  password: string,
  ip?: string,
  userAgent?: string
): Promise<{ token: string; user: Omit<User, 'password_hash'> }> {
  // Find user by username or email
  const user = await db('users')
    .where('username', identifier)
    .orWhere('email', identifier)
    .first();

  if (!user) {
    throw new AppError('Invalid username, email, or password.', 'ERR_INVALID_CREDENTIALS', 400);
  }

  if (user.status !== 'active') {
    throw new AppError('User account is inactive. Please contact the administrator.', 'ERR_INACTIVE_ACCOUNT', 403);
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMs = new Date(user.locked_until).getTime() - new Date().getTime();
    const remainingMins = Math.ceil(remainingMs / 60000);
    throw new AppError(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 'ERR_ACCOUNT_LOCKED', 403);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // Increment failed attempts
    const attempts = (user.failed_login_attempts || 0) + 1;
    const patch: any = { failed_login_attempts: attempts };
    
    // Check if lockout threshold is reached (e.g. 5 attempts)
    if (attempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 15);
      patch.locked_until = lockUntil;
    }
    
    await db('users').where('id', user.id).update(patch);
    throw new AppError('Invalid username, email, or password.', 'ERR_INVALID_CREDENTIALS', 400);
  }

  // Reset failed attempts & Update last login
  await db('users').where('id', user.id).update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: new Date()
  });

  // Generate session token
  const { rawToken, hash } = generateSessionToken();
  const sessionId = uuidv4();
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 12);

  // Save session
  await db('staff_sessions').insert({
    id: sessionId,
    user_id: user.id,
    token_hash: hash,
    issued_at: new Date(),
    expires_at: expiresAt,
    revoked_at: null,
    last_seen_at: new Date(),
    ip_address: ip || null,
    user_agent: userAgent || null,
    lifecycle_status: 'active'
  });

  // Remove password_hash from return user object
  const { password_hash, ...sanitizedUser } = user;

  return {
    token: rawToken,
    user: sanitizedUser
  };
}

export async function verifyStaffToken(rawToken: string): Promise<any> {
  if (!rawToken) return null;
  const hash = hashToken(rawToken);

  const session = await db('staff_sessions')
    .where('token_hash', hash)
    .first();

  if (!session) return null;

  if (session.lifecycle_status !== 'active') return null;
  if (session.revoked_at !== null) return null;
  
  const isExpired = new Date(session.expires_at) <= new Date();
  if (isExpired) return null;

  // Update last seen
  await db('staff_sessions')
    .where('id', session.id)
    .update({ last_seen_at: new Date() });

  return session;
}

export async function logoutStaff(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const hash = hashToken(rawToken);

  await db('staff_sessions')
    .where('token_hash', hash)
    .update({
      revoked_at: new Date(),
      lifecycle_status: 'inactive'
    });
}
