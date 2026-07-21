import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { 
  generateMfaSecret, 
  generateOtpAuthUri, 
  verifyMfaToken, 
  generateBackupCodes, 
  hashBackupCode,
  getSecuritySettingBool
} from '@/lib/auth/securityUtils';
import QRCode from 'qrcode';

// GET: Generate MFA Secret and QR Code for provisioning
export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const user = (req as any).user;
      
      const mfaEnabledGlobally = await getSecuritySettingBool('MFA_ENABLED', false);
      if (!mfaEnabledGlobally) {
        return errorResponse('MFA is not enabled on this system.', 'ERR_MFA_DISABLED', 400);
      }

      // Check if user is administrator or admin
      if (user.role !== 'administrator' && user.role !== 'admin') {
        return errorResponse('Only administrators can enable MFA.', 'ERR_UNAUTHORIZED', 403);
      }

      const secret = generateMfaSecret();
      const otpAuthUri = generateOtpAuthUri(user.email, secret);
      
      // Generate QR Code Data URL
      const qrCodeUrl = await QRCode.toDataURL(otpAuthUri);
      
      return successResponse({
        secret,
        qrCodeUrl
      }, 'MFA setup initialized.');
    } catch (error: any) {
      return errorResponse(error.message || 'MFA setup initialization failed.', 'ERR_INTERNAL_SERVER', 500);
    }
  });
}

// POST: Confirm MFA Setup and Enable
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const user = (req as any).user;
      
      const mfaEnabledGlobally = await getSecuritySettingBool('MFA_ENABLED', false);
      if (!mfaEnabledGlobally) {
        return errorResponse('MFA is not enabled on this system.', 'ERR_MFA_DISABLED', 400);
      }

      if (user.role !== 'administrator' && user.role !== 'admin') {
        return errorResponse('Only administrators can enable MFA.', 'ERR_UNAUTHORIZED', 403);
      }

      const body = await req.json();
      const { secret, code } = body;

      if (!secret || !code) {
        return errorResponse('Secret and verification code are required.', 'ERR_VALIDATION', 400);
      }

      // 1. Verify code against secret
      const isValid = verifyMfaToken(code, secret);
      if (!isValid) {
        return errorResponse('Invalid verification code. Please check your authenticator app.', 'ERR_INVALID_MFA_CODE', 400);
      }

      // 2. Generate backup recovery codes
      const plaintextBackupCodes = generateBackupCodes(8);
      const hashedBackupCodes = plaintextBackupCodes.map(c => hashBackupCode(c));

      // 3. Save to database
      await db('users')
        .where('id', user.id)
        .update({
          mfa_secret: secret,
          mfa_enabled: true,
          mfa_backup_codes: JSON.stringify(hashedBackupCodes),
          updated_at: new Date()
        });

      return successResponse({
        backupCodes: plaintextBackupCodes
      }, 'MFA successfully enabled.');
    } catch (error: any) {
      return errorResponse(error.message || 'MFA setup confirmation failed.', 'ERR_INTERNAL_SERVER', 500);
    }
  });
}
