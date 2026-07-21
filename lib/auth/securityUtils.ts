import { db } from '@/lib/db';
const { authenticator } = require('otplib');
import crypto from 'crypto';

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
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const enabled = await getSecuritySettingBool('TURNSTILE_ENABLED', false);
  if (!enabled) return true;
  
  if (!token) return false;
  
  const secretKey = await getSecuritySetting('TURNSTILE_SECRET_KEY', process.env.TURNSTILE_SECRET_KEY || '');
  if (!secretKey) {
    console.error('Turnstile is enabled but TURNSTILE_SECRET_KEY is not configured.');
    return false;
  }
  
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: ip
      })
    });
    
    const data = await res.json();
    return !!data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
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

