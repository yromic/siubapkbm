import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface AuditLogInput {
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  description?: string;
  ip_address?: string;
  user_agent?: string;
}

export async function createAuditLog(input: AuditLogInput) {
  try {
    await db('audit_logs').insert({
      id: uuidv4(),
      user_id: input.user_id || null,
      user_name: input.user_name || null,
      user_role: input.user_role || null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id || null,
      old_value: input.old_value ? JSON.stringify(input.old_value) : null,
      new_value: input.new_value ? JSON.stringify(input.new_value) : null,
      description: input.description || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      created_at: new Date()
    });
  } catch (e) {
    // non-critical, ignore
  }
}

export async function searchAuditLogs(
  filters: {
    user_id?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    date_from?: string;
    date_to?: string;
  } = {},
  page = 1,
  limit = 50
) {
  try {
    const query = db('audit_logs').orderBy('created_at', 'desc');

    if (filters.user_id) query.where('user_id', filters.user_id);
    if (filters.action) query.where('action', 'like', `%${filters.action}%`);
    if (filters.entity_type) query.where('entity_type', filters.entity_type);
    if (filters.entity_id) query.where('entity_id', filters.entity_id);
    if (filters.date_from) query.where('created_at', '>=', filters.date_from);
    if (filters.date_to) query.where('created_at', '<=', filters.date_to + ' 23:59:59');

    const totalRes = await query.clone().count('id as count').first();
    const total = Number(totalRes?.count || 0);

    const offset = (page - 1) * limit;
    const items = await query.limit(limit).offset(offset);

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error searching audit logs',
      'ERR_DATABASE',
      500
    );
  }
}
