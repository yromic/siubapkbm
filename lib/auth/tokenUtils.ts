import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export function generateSessionToken(): { rawToken: string; hash: string } {
  const rawToken = uuidv4();
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
