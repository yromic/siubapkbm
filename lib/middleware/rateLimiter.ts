import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getSecuritySettingNum } from '@/lib/auth/securityUtils';

/**
 * Checks if the request from the given IP/identifier exceeds the limit.
 * Returns true if the request is ALLOWED (not blocked), false if BLOCKED.
 * 
 * Implemented using a database-level transaction and FOR UPDATE locking to guarantee
 * atomicity and prevent race conditions on concurrent login requests.
 */
export async function checkRateLimit(ip: string, endpoint: string, identifier?: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_RATE_LIMIT) return true;
  if (!ip) return true; // Fail-safe: allow if IP is not provided
  
  // Composite key containing both IP and the user identifier
  const rateLimitKey = identifier ? `${ip}:${identifier.trim().toLowerCase()}` : ip;
  
  const windowMinutes = await getSecuritySettingNum('RATE_LIMIT_WINDOW', 15);
  const maxAttempts = await getSecuritySettingNum('RATE_LIMIT_MAX', 5);
  
  const windowMs = windowMinutes * 60 * 1000;
  const now = new Date();
  
  try {
    let allowed = true;
    
    await db.transaction(async (trx: any) => {
      // Find existing attempt record, locking the row for update
      const attempt = await trx('rate_limit_attempts')
        .where({ identifier: rateLimitKey, endpoint })
        .forUpdate()
        .first();
        
      if (!attempt) {
        // Create new record
        await trx('rate_limit_attempts').insert({
          id: uuidv4(),
          identifier: rateLimitKey,
          endpoint,
          attempts: 1,
          window_start: now,
          locked_until: null,
          created_at: now,
          updated_at: now
        });
        allowed = true;
        return;
      }
      
      // Check if currently locked
      if (attempt.locked_until && new Date(attempt.locked_until) > now) {
        allowed = false; // Blocked
        return;
      }
      
      const windowStart = new Date(attempt.window_start);
      const msSinceStart = now.getTime() - windowStart.getTime();
      
      if (msSinceStart > windowMs) {
        // Reset window
        await trx('rate_limit_attempts')
          .where('id', attempt.id)
          .update({
            attempts: 1,
            window_start: now,
            locked_until: null,
            updated_at: now
          });
        allowed = true;
      } else {
        const newAttempts = attempt.attempts + 1;
        const patch: any = {
          attempts: newAttempts,
          updated_at: now
        };
        
        if (newAttempts >= maxAttempts) {
          // Lock for the configured window
          const lockUntil = new Date(now.getTime() + windowMs);
          patch.locked_until = lockUntil;
          allowed = false;
        }
        
        await trx('rate_limit_attempts')
          .where('id', attempt.id)
          .update(patch);
      }
    });
    
    return allowed;
  } catch (error) {
    console.error('Rate limiter database error:', error);
    return true; // Fail-safe: allow if DB fails
  }
}

/**
 * Resets the rate limit for a specific IP + identifier combination.
 * Useful on successful authentication to immediately clear previous failed attempt counts.
 */
export async function resetRateLimit(ip: string, endpoint: string, identifier?: string): Promise<void> {
  const rateLimitKey = identifier ? `${ip}:${identifier.trim().toLowerCase()}` : ip;
  try {
    await db('rate_limit_attempts')
      .where({ identifier: rateLimitKey, endpoint })
      .delete();
  } catch (error) {
    console.error('Rate limiter reset error:', error);
  }
}
