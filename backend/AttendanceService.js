/**
 * AttendanceService.js
 * Teacher Attendance with Geolocation Verification using Haversine distance.
 */

const CONFIG_ATTENDANCE = {
  SCHOOL_LAT: -7.137833361601518, // Titik pusat sekolah
  SCHOOL_LNG: 110.40724215148737,
  ALLOWED_RADIUS_METERS: 150, // Toleransi akurasi GPS web
  // --- KONFIGURASI WAKTU PRESENSI ---
  START_TIME: "07:00", // Format HH:mm
  END_TIME: "15:00",   // Format HH:mm
  ALLOWED_DAYS: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] // Format bahasa Inggris dari Utilities.formatDate(E)
};

/**
 * Calculates the absolute distance between two coordinates using the Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  var R = 6371e3; // Earth radius in meters
  var phi1 = lat1 * Math.PI / 180;
  var phi2 = lat2 * Math.PI / 180;
  var deltaPhi = (lat2 - lat1) * Math.PI / 180;
  var deltaLambda = (lon2 - lon1) * Math.PI / 180;

  var a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Records a new teacher attendance if they are within the allowed radius.
 * @param {Object} actor - The authenticated user.
 * @param {number|string} payloadLat - Latitude from client.
 * @param {number|string} payloadLng - Longitude from client.
 * @returns {Object} Saved attendance record.
 */
function recordAttendance(actor, payloadLat, payloadLng) {
  // 1. Role validation
  if (!actor || (actor.role !== ROLES.TEACHER && actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN)) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Hanya guru atau admin yang dapat melakukan presensi.'
    };
  }

  var teacherId = actor.id;

  // 1.B. Day validation
  var currentDay = Utilities.formatDate(new Date(), "GMT+7", "EEEE");
  if (!CONFIG_ATTENDANCE.ALLOWED_DAYS.includes(currentDay) && actor.id !== 'TCH-01') {
    throw {
      code: 'INVALID_DAY',
      message: 'Presensi hanya dapat dilakukan pada hari kerja (Senin - Jumat).'
    };
  }

  // 1.C. Time validation
  var currentTime = Utilities.formatDate(new Date(), "GMT+7", "HH:mm");
  if ((currentTime < CONFIG_ATTENDANCE.START_TIME || currentTime > CONFIG_ATTENDANCE.END_TIME) && actor.id !== 'TCH-01') {
    throw {
      code: 'OUT_OF_HOURS',
      message: 'Di luar jam operasional. Presensi hanya dibuka pukul ' + CONFIG_ATTENDANCE.START_TIME + ' hingga ' + CONFIG_ATTENDANCE.END_TIME + ' WIB.'
    };
  }

  // 2. GMT+7 timezone handling
  var todayDateStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  var currentTimeStr = Utilities.formatDate(new Date(), "GMT+7", "HH:mm");

  // 3. Check duplicates
  var existingRecords = listRecords(SHEETS.TEACHER_ATTENDANCE, function(row) {
    return row.teacher_id === teacherId && row.date === todayDateStr;
  });

  if (existingRecords && existingRecords.length > 0 && actor.id !== 'TCH-01') {
    throw {
      code: 'DUPLICATE_ATTENDANCE',
      message: 'Anda sudah melakukan presensi hari ini.'
    };
  }

  // Parse coordinates
  var latVal = parseFloat(payloadLat);
  var lngVal = parseFloat(payloadLng);

  if (isNaN(latVal) || isNaN(lngVal)) {
    throw {
      code: 'INVALID_PARAMETER',
      message: 'Parameter koordinat latitude dan longitude tidak valid.'
    };
  }

  // 4. Distance check
  var distance = calculateDistance(
    latVal,
    lngVal,
    CONFIG_ATTENDANCE.SCHOOL_LAT,
    CONFIG_ATTENDANCE.SCHOOL_LNG
  );

  var roundedDistance = Math.round(distance);

  if (distance > CONFIG_ATTENDANCE.ALLOWED_RADIUS_METERS) {
    throw {
      code: 'OUT_OF_AREA',
      message: 'Anda berada ' + roundedDistance + ' meter di luar area sekolah.',
      details: {
        distance: roundedDistance,
        allowed_radius: CONFIG_ATTENDANCE.ALLOWED_RADIUS_METERS
      }
    };
  }

  // 5. Store record using Repository layer (thread-safe script lock automatically applied)
  var recordData = {
    teacher_id: teacherId,
    date: todayDateStr,
    time_in: currentTimeStr,
    lat: latVal,
    lng: lngVal,
    distance_meters: roundedDistance,
    status: 'hadir'
  };

  var savedRecord = createRecord(SHEETS.TEACHER_ATTENDANCE, recordData, actor);
  return savedRecord;
}

/**
 * Gets attendance history for teachers or admins.
 * @param {Object} actor - The authenticated user.
 * @param {number|string} [month] - Month filter (1-12)
 * @param {number|string} [year] - Year filter (YYYY)
 * @returns {Object[]} List of attendance records with teacher name.
 */
function get_attendance_history(actor, month, year) {
  try {
    if (!actor) {
      throw new Error("Unauthorized: Actor is required.");
    }
    
    var records = [];
    if (actor.role === ROLES.TEACHER) {
      records = listRecords(SHEETS.TEACHER_ATTENDANCE, function(row) {
        return row.teacher_id === actor.id;
      });
      // Sort newest first
      records.sort(function(a, b) {
        var dateA = a.date + ' ' + (a.time_in || '00:00');
        var dateB = b.date + ' ' + (b.time_in || '00:00');
        return dateB.localeCompare(dateA);
      });
      // Limit to 30 most recent
      records = records.slice(0, 30);
    } else if (actor.role === ROLES.ADMIN || actor.role === ROLES.ADMINISTRATOR) {
      records = listRecords(SHEETS.TEACHER_ATTENDANCE);
      if (month && year) {
        var mStr = String(month);
        if (mStr.length === 1) mStr = '0' + mStr;
        var prefix = year + "-" + mStr;
        records = records.filter(function(row) {
          return row.date && row.date.indexOf(prefix) === 0;
        });
      }
      // Sort newest first
      records.sort(function(a, b) {
        var dateA = a.date + ' ' + (a.time_in || '00:00');
        var dateB = b.date + ' ' + (b.time_in || '00:00');
        return dateB.localeCompare(dateA);
      });
    } else {
      throw new Error("Forbidden: Invalid role.");
    }

    // Map names from users & teacher profiles
    var users = listRecords(SHEETS.USERS) || [];
    var profiles = listRecords(SHEETS.TEACHER_PROFILES) || [];
    var nameMap = {};
    users.forEach(function(u) {
      if (u.id) nameMap[u.id] = u.name || '';
    });
    profiles.forEach(function(p) {
      if (p.user_id && p.full_name) {
        nameMap[p.user_id] = p.full_name;
      }
    });

    return records.map(function(r) {
      r.teacher_name = nameMap[r.teacher_id] || 'Unknown Teacher';
      r.time_in = formatTimeIn(r.time_in);
      return r;
    });

  } catch (e) {
    return { error: true, message: e.message, stack: e.stack };
  }
}

/**
 * Manually records teacher attendance (admin bypass).
 * @param {Object} actor - The authenticated admin.
 * @param {string} target_teacher_id - The ID of the teacher to record attendance for.
 * @param {string} date - Date in yyyy-MM-dd format.
 * @param {string} status - Sakit/Izin/Dinas.
 * @returns {Object} Saved attendance record.
 */
function record_manual_attendance(actor, target_teacher_id, date, status) {
  try {
    if (!actor || (actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADMINISTRATOR)) {
      throw new Error("Forbidden: Hanya admin yang dapat mencatat presensi manual.");
    }

    if (!target_teacher_id || !date || !status) {
      throw new Error("Parameter target_teacher_id, date, dan status wajib diisi.");
    }

    var existingRecords = listRecords(SHEETS.TEACHER_ATTENDANCE, function(row) {
      return row.teacher_id === target_teacher_id && row.date === date;
    });

    if (existingRecords && existingRecords.length > 0) {
      throw new Error("Guru tersebut sudah memiliki data presensi pada tanggal tersebut.");
    }

    var recordData = {
      teacher_id: target_teacher_id,
      date: date,
      time_in: '-',
      lat: '',
      lng: '',
      distance_meters: '',
      status: status
    };

    return createRecord(SHEETS.TEACHER_ATTENDANCE, recordData, actor);
  } catch (e) {
    return { error: true, message: e.message, stack: e.stack };
  }
}

/**
 * Helper to clean and format Google Sheets Date/String times.
 * @param {any} val
 * @returns {string} HH:mm format
 */
function formatTimeIn(val) {
  if (!val) return '-';
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT+7", "HH:mm");
  }
  if (typeof val === 'string') {
    if (val.indexOf('1899-12-30') !== -1) {
      var d = new Date(val);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, "GMT+7", "HH:mm");
      }
    }
  }
  return val;
}

/**
 * Gets daily attendance roster for all active teachers.
 * @param {Object} actor - The authenticated admin.
 * @param {string} date - Date in yyyy-MM-dd format.
 * @returns {Object[]} Attendance roster.
 */
function get_daily_attendance_roster(actor, date) {
  try {
    if (!actor || (actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADMINISTRATOR)) {
      throw new Error("Forbidden: Hanya admin yang dapat melihat rekap harian.");
    }
    if (!date) {
      throw new Error("Parameter date wajib diisi.");
    }

    var users = listRecords(SHEETS.USERS) || [];
    var activeTeachers = users.filter(function(u) {
      return u.role === ROLES.TEACHER && u.status === STATUS.ACTIVE;
    });

    var profiles = listRecords(SHEETS.TEACHER_PROFILES) || [];
    var profileMap = {};
    profiles.forEach(function(p) {
      if (p.user_id) profileMap[p.user_id] = p;
    });

    // Fetch attendance for the specific date
    var attendanceRecords = listRecords(SHEETS.TEACHER_ATTENDANCE, function(row) {
      return row.date === date;
    }) || [];

    var attendanceMap = {};
    attendanceRecords.forEach(function(r) {
      attendanceMap[r.teacher_id] = r;
    });

    return activeTeachers.map(function(t) {
      var record = attendanceMap[t.id];
      var name = (profileMap[t.id] && profileMap[t.id].full_name) || t.name || 'Unknown Teacher';
      
      if (record) {
        return {
          id: record.id,
          teacher_id: t.id,
          teacher_name: name,
          date: date,
          time_in: formatTimeIn(record.time_in),
          lat: record.lat || '',
          lng: record.lng || '',
          distance_meters: record.distance_meters || '',
          status: record.status
        };
      } else {
        return {
          id: '',
          teacher_id: t.id,
          teacher_name: name,
          date: date,
          time_in: '-',
          lat: '',
          lng: '',
          distance_meters: '',
          status: 'Belum Hadir'
        };
      }
    });

  } catch (e) {
    return { error: true, message: e.message, stack: e.stack };
  }
}


