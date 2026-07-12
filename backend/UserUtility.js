/**
 * UserUtility.gs
 * Utility functions to create and manage operator (admin) and teacher accounts.
 * These functions are idempotent and can be run from the Apps Script editor.
 */

/**
 * Creates or updates a staff user account.
 * 
 * @param {string} name - Full Name of the staff.
 * @param {string} email - Email address (unique identifier).
 * @param {string} username - Username for login (unique identifier).
 * @param {string} password - Raw password (will be hashed).
 * @param {string} role - Role of the staff ('admin' or 'teacher').
 * @param {string} [phone] - Optional phone number.
 * @param {Object} [actor] - Optional actor metadata representing who performed the change.
 * @returns {Object} The created or updated user record.
 */
function createStaffUser(name, email, username, password, role, phone, actor) {
  if (!actor) {
    actor = { id: 'system_utility', name: 'User Creation Utility', role: 'administrator' };
  }

  if (!name || !email || !username || !password || !role) {
    throw new Error("Missing required fields. Name, email, username, password, and role are required.");
  }

  // Check roles
  var allowedRoles = [ROLES.ADMIN, ROLES.TEACHER, ROLES.ADMINISTRATOR];
  if (allowedRoles.indexOf(role) === -1) {
    throw new Error("Invalid role: " + role + ". Supported roles: " + allowedRoles.join(', '));
  }

  // Clean inputs
  email = email.trim().toLowerCase();
  username = username.trim().toLowerCase();
  phone = phone ? phone.trim() : '';

  // Look for existing user
  var existingUser = getUserByIdentifier(email) || getUserByIdentifier(username);
  var userRecord;

  if (existingUser) {
    console.log("User already exists with ID: " + existingUser.id + ". Updating user details.");
    
    var userPatch = {
      name: name,
      phone: phone,
      role: role,
      status: STATUS.ACTIVE
    };

    // If password is provided, rehash and update it
    if (password) {
      userPatch.password_hash = hashPassword(password);
    }

    userRecord = updateRecord(SHEETS.USERS, existingUser.id, userPatch, actor);
  } else {
    console.log("Creating new user account for: " + username);
    
    var newUser = {
      name: name,
      email: email,
      username: username,
      password_hash: hashPassword(password),
      role: role,
      phone: phone,
      status: STATUS.ACTIVE,
      failed_login_attempts: 0,
      locked_until: '',
      last_login_at: ''
    };

    userRecord = createRecord(SHEETS.USERS, newUser, actor);
  }

  return userRecord;
}

/**
 * Creates or updates a teacher user account along with their teacher profile.
 * 
 * @param {string} name - Full Name of the teacher.
 * @param {string} email - Email address.
 * @param {string} username - Username.
 * @param {string} password - Raw password.
 * @param {string} [phone] - Phone number.
 * @param {Object} [profileFields] - Optional profile fields like nip, nuptk, position, address, gender.
 * @param {Object} [actor] - Optional actor metadata.
 * @returns {Object} An object containing the user and profile records.
 */
function createTeacherWithProfile(name, email, username, password, phone, profileFields, actor) {
  if (!actor) {
    actor = { id: 'system_utility', name: 'User Creation Utility', role: 'administrator' };
  }

  profileFields = profileFields || {};

  // 1. Create the teacher staff user record
  var userRecord = createStaffUser(name, email, username, password, ROLES.TEACHER, phone, actor);

  // 2. Resolve teacher profiles sheet entry
  var existingProfiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
    return p.user_id === userRecord.id;
  });

  var profileData = {
    user_id: userRecord.id,
    full_name: name,
    gender: profileFields.gender || '',
    phone: phone || profileFields.phone || '',
    address: profileFields.address || '',
    nip: profileFields.nip || '',
    nuptk: profileFields.nuptk || '',
    position: profileFields.position || 'Guru',
    status: STATUS.ACTIVE
  };

  var profileRecord;
  if (existingProfiles.length > 0) {
    console.log("Teacher profile already exists. Updating profile.");
    profileRecord = updateRecord(SHEETS.TEACHER_PROFILES, existingProfiles[0].id, profileData, actor);
  } else {
    console.log("Creating new teacher profile.");
    profileRecord = createRecord(SHEETS.TEACHER_PROFILES, profileData, actor);
  }

  return {
    user: userRecord,
    profile: profileRecord
  };
}

/**
 * Administrative entrypoint to batch create accounts.
 * Edit this function directly in Google Apps Script editor to add/modify accounts,
 * then select and run this function.
 */
function runBatchCreateAccounts() {
  console.log("--- BATCH USER CREATION UTILITY ---");
  var actor = { id: 'admin_utility', name: 'Manual Account Creator', role: 'administrator' };

  try {
    // -------------------------------------------------------------
    // 1. INPUT ACCOUNT OPERATOR DI SINI (Contoh)
    // -------------------------------------------------------------
    var operators = [
      {
        name: "Operator SIUBA",
        email: "operator@example.com",
        username: "operator",
        password: "Operator123!",
        phone: "08123456789"
      }
    ];

    // -------------------------------------------------------------
    // 2. INPUT ACCOUNT GURU DI SINI (Contoh)
    // -------------------------------------------------------------
    var teachers = [
      {
        name: "Budi Santoso, S.Pd.",
        email: "budi.teacher@example.com",
        username: "buditeacher",
        password: "Teacher123!",
        phone: "08987654321",
        profile: {
          gender: "L",
          nip: "198503152010121002",
          nuptk: "9876543210123456",
          position: "Wali Kelas 5",
          address: "Jl. Merdeka No. 12, Bandung"
        }
      },
      {
        name: "Siti Aminah, S.Pd.",
        email: "siti.teacher@example.com",
        username: "sititeacher",
        password: "Teacher123!",
        phone: "087712345678",
        profile: {
          gender: "P",
          nip: "199008242015032001",
          nuptk: "1234567890123456",
          position: "Guru Bidang Studi",
          address: "Perum Indah Regency Blok B-3, Bandung"
        }
      }
    ];

    // 3. Proses Pembuatan Operator
    console.log("\n[PROSES OPERATOR]");
    operators.forEach(function(op) {
      var opUser = createStaffUser(
        op.name,
        op.email,
        op.username,
        op.password,
        ROLES.ADMIN, // Operator role
        op.phone,
        actor
      );
      console.log("Success: Operator '" + opUser.username + "' is ready. ID: " + opUser.id);
    });

    // 4. Proses Pembuatan Guru
    console.log("\n[PROSES GURU]");
    teachers.forEach(function(t) {
      var tResult = createTeacherWithProfile(
        t.name,
        t.email,
        t.username,
        t.password,
        t.phone,
        t.profile,
        actor
      );
      console.log("Success: Teacher '" + tResult.user.username + "' and profile are ready. UserID: " + tResult.user.id + ", ProfileID: " + tResult.profile.id);
    });

    console.log("\nBatch creation process completed successfully!");

  } catch (error) {
    console.error("Error during batch user creation: " + error.message);
    throw error;
  }
}
