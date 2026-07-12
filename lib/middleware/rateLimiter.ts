import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if the request from the given IP/identifier exceeds the limit.
 * Returns true if the request is ALLOWED (not blocked), false if BLOCKED.
 */
export async function checkRateLimit(ip: string, endpoint: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!ip) return true; // Fail-safe: allow if IP is not provided
  
  const now = new Date();
  
  try {
    // Find existing attempt record
    const attempt = await db('rate_limit_attempts')
      .where({ identifier: ip, endpoint })
      .first();
      
    if (!attempt) {
      // Create new record
      await db('rate_limit_attempts').insert({
        id: uuidv4(),
        identifier: ip,
        endpoint,
        attempts: 1,
        window_start: now,
        locked_until: null,
        created_at: now,
        updated_at: now
      });
      return true;
    }
    
    // Check if currently locked
    if (attempt.locked_until && new Date(attempt.locked_until) > now) {
      return false; // Blocked
    }
    
    const windowStart = new Date(attempt.window_start);
    const msSinceStart = now.getTime() - windowStart.getTime();
    
    if (msSinceStart > WINDOW_MS) {
      // Reset window
      await db('rate_limit_attempts')
        .where('id', attempt.id)
        .update({
          attempts: 1,
          window_start: now,
          locked_until: null,
          updated_at: now
        });
      return true;
    } else {
      const newAttempts = attempt.attempts + 1;
      const patch: any = {
        attempts: newAttempts,
        updated_at: now
      };
      
      let allowed = true;
      if (newAttempts >= LIMIT) {
        // Lock for 15 minutes
        const lockUntil = new Date(now.getTime() + WINDOW_MS);
        patch.locked_until = lockUntil;
        allowed = false;
      }
      
      await db('rate_limit_attempts')
        .where('id', attempt.id)
        .update(patch);
        
      return allowed;
    }
  } catch (error) {
    console.error('Rate limiter database error:', error);
    return true; // Fail-safe: allow if DB fails
  }
}
