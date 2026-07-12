import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const indicators = await db('culture_indicators')
          .whereNot('lifecycle_status', 'soft_deleted')
          .orderBy('code', 'asc');

        const characterValues = await db('character_values')
          .whereNot('lifecycle_status', 'soft_deleted')
          .orderBy('code', 'asc');

        const mappings = await db('culture_character_mappings')
          .join('culture_indicators', 'culture_character_mappings.culture_indicator_id', 'culture_indicators.id')
          .join('character_values', 'culture_character_mappings.character_value_id', 'character_values.id')
          .whereNot('culture_character_mappings.lifecycle_status', 'soft_deleted')
          .select(
            'culture_character_mappings.*',
            'culture_indicators.code as indicator_code',
            'culture_indicators.name as indicator_name',
            'character_values.code as character_code',
            'character_values.name as character_name'
          );

        return successResponse({ indicators, character_values: characterValues, mappings }, 'Culture master data retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
