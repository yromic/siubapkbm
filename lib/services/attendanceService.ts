import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const row = await db('app_settings').where('setting_key', key).first();
    if (row) return row.setting_value;

    await db('app_settings').insert({
      setting_key: key,
      setting_value: defaultValue,
      description: `Auto-generated setting for ${key}`,
      created_at: new Date(),
      updated_at: new Date()
    });
    return defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export async function recordAttendance(teacherId: string, lat: number, lng: number) {
  if (lat === undefined || lng === undefined) {
    throw new AppError('Coordinates (lat, lng) are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check unique: one attendance record per teacher per date
    const existing = await db('teacher_attendance')
      .where({ teacher_id: teacherId, date: todayStr })
      .first();

    if (existing) {
      throw new AppError('You have already recorded attendance for today.', 'ERR_VALIDATION', 400);
    }

    // Fetch school config
    const schoolLat = parseFloat(await getSetting('school_lat', '-6.200000'));
    const schoolLng = parseFloat(await getSetting('school_lng', '106.816666'));
    const radius = parseFloat(await getSetting('geofence_radius', '100'));
    const startTimeStr = await getSetting('school_start_time', '08:00:00');

    const distance = calculateHaversineDistance(lat, lng, schoolLat, schoolLng);
    
    let status = 'present';
    if (distance > radius) {
      status = 'outside_geofence';
    } else {
      const timeNowStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
      if (timeNowStr > startTimeStr) {
        status = 'late';
      }
    }

    const timeInStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const id = uuidv4();
    const newRecord = {
      id,
      teacher_id: teacherId,
      date: todayStr,
      time_in: timeInStr,
      lat,
      lng,
      distance_meters: parseFloat(distance.toFixed(2)),
      status,
      lifecycle_status: 'active',
      created_at: now,
      updated_at: now
    };

    await db('teacher_attendance').insert(newRecord);
    return newRecord;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error recording attendance',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getMyAttendance(teacherId: string, month?: number, year?: number) {
  try {
    const query = db('teacher_attendance')
      .where('teacher_id', teacherId)
      .whereNot('lifecycle_status', 'soft_deleted');

    if (month) {
      query.whereRaw('MONTH(date) = ?', [month]);
    }
    if (year) {
      query.whereRaw('YEAR(date) = ?', [year]);
    }

    return await query.orderBy('date', 'desc');
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting attendance history',
      'ERR_DATABASE',
      500
    );
  }
}

export async function recordManual(targetTeacherId: string, date: string, status: string) {
  if (!targetTeacherId || !date || !status) {
    throw new AppError('Teacher ID, date, and status are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('teacher_attendance')
      .where({ teacher_id: targetTeacherId, date })
      .first();

    const dataToSave = {
      time_in: '08:00:00', // default check-in time for manual
      lat: 0.0,
      lng: 0.0,
      distance_meters: 0.0,
      status,
      updated_at: new Date()
    };

    if (existing) {
      await db('teacher_attendance').where('id', existing.id).update(dataToSave);
      return { ...existing, ...dataToSave };
    } else {
      const id = uuidv4();
      const newRecord = {
        id,
        teacher_id: targetTeacherId,
        date,
        ...dataToSave,
        lifecycle_status: 'active',
        created_at: new Date()
      };
      await db('teacher_attendance').insert(newRecord);
      return newRecord;
    }
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error recording manual attendance',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getDailyRoster(date: string) {
  if (!date) {
    throw new AppError('Date is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const items = await db('users')
      .leftJoin('teacher_attendance', function () {
        this.on('users.id', '=', 'teacher_attendance.teacher_id')
          .andOn(db.raw('DATE(teacher_attendance.date) = ?', [date]));
      })
      .where('users.role', 'teacher')
      .whereNot('users.lifecycle_status', 'soft_deleted')
      .select(
        'users.id as teacher_id',
        'users.name as teacher_name',
        'users.email as teacher_email',
        'teacher_attendance.id as attendance_id',
        'teacher_attendance.time_in',
        'teacher_attendance.status as attendance_status',
        'teacher_attendance.distance_meters'
      )
      .orderBy('users.name', 'asc');

    return items;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing daily roster',
      'ERR_DATABASE',
      500
    );
  }
}
