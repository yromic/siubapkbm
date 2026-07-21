import { db } from '@/lib/db';
const { authenticator } = require('otplib');
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { validateAltchaConfig } from './altchaConfig';
export { validateAltchaConfig };

/**
 * Gets a configuration value from the `app_settings` table, falling back to env variables, then defaultValue.
 */
export async function getSecuritySetting(key: string, defaultValue: string): Promise<string> {
  try {
    const row = await db('app_settings').where('setting_key', key).first();
    if (row && row.setting_value !== undefined && row.setting_value !== null) {
      return row.setting_value;
    }
  } catch (e) {
    // Fail-safe to env/default
  }
  return process.env[key] || defaultValue;
}

/**
 * Helper to get a numeric configuration setting.
 */
export async function getSecuritySettingNum(key: string, defaultValue: number): Promise<number> {
  const val = await getSecuritySetting(key, String(defaultValue));
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper to get a boolean configuration setting.
 */
export async function getSecuritySettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const val = await getSecuritySetting(key, String(defaultValue));
  return val === 'true' || val === '1';
}

/**
 * Calculates progressive delay in milliseconds based on the number of failed attempts.
 * Attempt 1-3: No delay (0 ms)
 * Attempt 4: 2000 ms (2 seconds)
 * Attempt 5: 4000 ms (4 seconds)
 * Attempt 6: 8000 ms (8 seconds)
 * Attempt 7+: Doubling up to MAX_PROGRESSIVE_DELAY (configurable, default 16s)
 */
export async function getProgressiveDelayMs(attempts: number): Promise<number> {
  if (attempts < 4) return 0;
  
  const maxDelaySeconds = await getSecuritySettingNum('MAX_PROGRESSIVE_DELAY', 16);
  const exponent = attempts - 4; // 0 for attempt 4, 1 for attempt 5, 2 for attempt 6...
  const delaySeconds = Math.min(2 * Math.pow(2, exponent), maxDelaySeconds);
  
  return delaySeconds * 1000;
}

/**
 * Sleeps for the given milliseconds.
 */
export async function applyDelay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifies Cloudflare Turnstile response token server-side.
 */
// Memory cache for replay protection of solved ALTCHA signatures
const altchaReplayCache = new Set<string>();

/**
 * Generates an ALTCHA challenge.
 */
export function generateAltchaChallenge(hmacKey: string, difficulty: number, maxAgeSeconds: number) {
  const expiry = Date.now() + maxAgeSeconds * 1000;
  const salt = crypto.randomBytes(16).toString('hex') + '?' + expiry;
  const number = crypto.randomInt(0, difficulty);
  
  // Create challenge hash
  const challenge = crypto.createHash('sha256').update(salt + number).digest('hex');
  
  // Create signature
  const signature = crypto.createHmac('sha256', hmacKey).update(challenge).digest('hex');
  
  return {
    algorithm: 'SHA-256',
    challenge,
    salt,
    signature,
    maxnumber: difficulty
  };
}

/**
 * Verifies an ALTCHA challenge.
 */
export async function verifyAltchaChallenge(payloadStr: string, hmacKey: string): Promise<boolean> {
  if (!payloadStr) return false;
  try {
    const payloadBytes = Buffer.from(payloadStr, 'base64').toString('utf8');
    const payload = JSON.parse(payloadBytes);
    const { challenge, salt, signature, number } = payload;
    
    if (!challenge || !salt || !signature || typeof number !== 'number') return false;
    
    // 1. Replay Protection
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      if (altchaReplayCache.has(signature)) {
        console.warn('ALTCHA: Replay attack detected for signature:', signature);
        return false;
      }
    }
    
    // 2. Signature Validation
    const expectedSignature = crypto.createHmac('sha256', hmacKey).update(challenge).digest('hex');
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedSigBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
      return false;
    }
    
    // 3. PoW Solution Validation
    const expectedChallenge = crypto.createHash('sha256').update(salt + number).digest('hex');
    if (challenge !== expectedChallenge) return false;
    
    // 4. Expiration Check
    const parts = salt.split('?');
    if (parts.length < 2) return false;
    const expiry = parseInt(parts[1], 10);
    if (isNaN(expiry) || expiry < Date.now()) return false;
    
    if (isDev) {
      // Add to replay cache and schedule removal upon expiration
      altchaReplayCache.add(signature);
      
      // Evict oldest entries if capacity is exceeded
      const maxCacheSizeStr = process.env.ALTCHA_MAX_REPLAY_CACHE_SIZE;
      const maxCacheSize = maxCacheSizeStr ? parseInt(maxCacheSizeStr, 10) : 10000;
      const finalCacheSize = isNaN(maxCacheSize) ? 10000 : maxCacheSize;
      while (altchaReplayCache.size > finalCacheSize) {
        const oldest = altchaReplayCache.values().next().value;
        if (oldest) {
          altchaReplayCache.delete(oldest);
        } else {
          break;
        }
      }
      
      setTimeout(() => {
        altchaReplayCache.delete(signature);
      }, Math.max(0, expiry - Date.now()));
    } else {
      // Production: Persistent replay protection using database
      
      // Probabilistic cleanup: 5% of requests clean up expired entries
      if (Math.random() < 0.05) {
        try {
          await db('altcha_replays')
            .where('expires_at', '<', new Date())
            .delete();
        } catch (err) {
          console.error('ALTCHA replay cache cleanup error:', err);
        }
      }
      
      // Atomic insert. If duplicate, unique constraint violation occurs.
      try {
        await db('altcha_replays').insert({
          id: uuidv4(),
          signature,
          expires_at: new Date(expiry),
          created_at: new Date()
        });
      } catch (err: any) {
        // MySQL error codes: ER_DUP_ENTRY is 1062, sqlState is '23000'
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062 || err.sqlState === '23000') {
          console.warn('ALTCHA: Replay attack detected (DB) for signature:', signature);
          return false;
        }
        console.error('ALTCHA database replay protection error:', err);
        return false; // Fail securely if DB write fails
      }
    }
    
    return true;
  } catch (error) {
    console.error('ALTCHA verification error:', error);
    return false;
  }
}


/**
 * Generates a TOTP secret.
 */
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generates an OTP Auth Key URI for provisioning Google Authenticator/etc.
 */
export function generateOtpAuthUri(email: string, secret: string): string {
  const issuer = 'SIUBA PKBM';
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Verifies a 6-digit TOTP token against a secret.
 */
export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    // Allows 1 time-step window skew (+/- 30 seconds) for user clock desync
    authenticator.options = { window: 1 };
    return authenticator.verify({ token, secret });
  } catch (e) {
    return false;
  }
}

/**
 * Generates cryptographically secure alpha-numeric backup codes.
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generates a random 10-character code
    const code = crypto.randomBytes(5).toString('hex');
    codes.push(code);
  }
  return codes;
}

/**
 * Hashing function to store backup codes securely.
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

/**
 * Encrypts a user ID into a secure temporary MFA token valid for 5 minutes.
 */
export function encryptMfaToken(userId: string): string {
  const data = JSON.stringify({ userId, exp: Date.now() + 5 * 60 * 1000 });
  const secretKey = process.env.SESSION_HASH_SALT || 'default_mfa_sign_secret_key_123456';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = Buffer.alloc(16, 0); // 16 bytes IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts a secure temporary MFA token, returning the user ID if valid.
 */
export function decryptMfaToken(token: string): string | null {
  try {
    const secretKey = process.env.SESSION_HASH_SALT || 'default_mfa_sign_secret_key_123456';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const parsed = JSON.parse(decrypted);
    if (parsed.exp < Date.now()) return null;
    return parsed.userId;
  } catch (e) {
    return null;
  }
}

