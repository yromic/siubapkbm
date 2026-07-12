/**
 * SeedService.gs
 * Handles initial database table creation and seeder scripts.
 * All scripts are designed to be idempotent.
 */

/**
 * Creates all spreadsheet sheets if they do not exist and validates headers.
 */
function setupDatabase() {
  var sheets = Object.keys(SHEET_HEADERS);
  sheets.forEach(function(sheetName) {
    var headers = SHEET_HEADERS[sheetName];
    ensureSheetHeaders(sheetName, headers);
  });
}

/**
 * Runs all seed functions in an idempotent manner.
 */
function seedInitialData() {
  var actor = { id: 'seeder', name: 'Database Seeder', role: 'system' };
  
  // 1. Setup sheets structure first
  setupDatabase();
  
  // 2. Seed master data
  seedDefaultAdmin(actor);
  seedCultureIndicators(actor);
  seedCharacterValues(actor);
  seedCultureCharacterMappings(actor);
  seedCultureCoverageSettings(actor);
}

function seedCultureCoverageSettings(actor) {
  var defaults = {
    culture_school_days: 'monday,tuesday,wednesday,thursday,friday',
    culture_minimum_coverage_percent: '80',
    culture_warning_coverage_percent: '60'
  };
  Object.keys(defaults).forEach(function(key) {
    var exists = listRecords(SHEETS.APP_SETTINGS, function(r) { return r.setting_key === key; });
    if (exists.length === 0) updateSingleSetting(key, defaults[key], actor);
  });
}

/**
 * Seeds the default admin account.
 * @param {Object} actor
 */
function seedDefaultAdmin(actor) {
  var existing = getUserByIdentifier(DEFAULT_ADMIN.username) || getUserByIdentifier(DEFAULT_ADMIN.email);
  if (existing) {
    console.log("Default admin already seeded. Skipping.");
    return;
  }
  
  var passwordHash = hashPassword(DEFAULT_ADMIN.password);
  var adminRecord = {
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    username: DEFAULT_ADMIN.username,
    password_hash: passwordHash,
    role: DEFAULT_ADMIN.role,
    status: DEFAULT_ADMIN.status,
    failed_login_attempts: 0,
    locked_until: '',
    last_login_at: ''
  };
  
  createRecord(SHEETS.USERS, adminRecord, actor);
  console.log("Default admin successfully seeded.");
}

/**
 * Seeds culture indicators (SAHABAT).
 * @param {Object} actor
 */
function seedCultureIndicators(actor) {
  var indicators = [
    { code: 'SSS', name: 'Senyum, Sapa, Salam', description: 'Membudayakan 3S di lingkungan sekolah.' },
    { code: 'AM', name: 'Asyik Mengaji', description: 'Kegiatan mengaji harian dengan senang.' },
    { code: 'HB', name: 'Hormat & Berbakti', description: 'Menghormati guru, orang tua, dan sesama.' },
    { code: 'ASM', name: 'Aku Suka Membaca', description: 'Kegiatan membaca buku secara rutin.' },
    { code: 'BR', name: 'Bersih & Rapi', description: 'Menjaga kebersihan diri dan kerapian lingkungan.' },
    { code: 'AK', name: 'Aktif Berkarya', description: 'Semangat berkarya dan menghasilkan sesuatu.' },
    { code: 'TM', name: 'Tolong Menolong', description: 'Membantu teman dan orang lain yang membutuhkan.' }
  ];
  
  indicators.forEach(function(ind) {
    var existingList = listRecords(SHEETS.CULTURE_INDICATORS, function(item) {
      return item.code === ind.code;
    });
    if (existingList.length > 0) return; // Skip if exists
    
    var record = {
      code: ind.code,
      name: ind.name,
      description: ind.description,
      status: STATUS.ACTIVE
    };
    createRecord(SHEETS.CULTURE_INDICATORS, record, actor);
  });
  console.log("Culture indicators seeded.");
}

/**
 * Seeds character values (FITRAH).
 * @param {Object} actor
 */
function seedCharacterValues(actor) {
  var values = [
    { code: 'F', name: 'Fathonah', description: 'Kecerdasan, kritis, dan literasi.' },
    { code: 'I', name: 'Istiqamah', description: 'Keteguhan dalam ibadah dan prinsip.' },
    { code: 'T', name: 'Tanggung Jawab', description: 'Kemandirian dan disiplin.' },
    { code: 'R', name: 'Ramah', description: 'Adab, sopan santun, dan kepatuhan.' },
    { code: 'A', name: 'Amanah', description: 'Jujur berkarya sesuai syariat.' },
    { code: 'H', name: 'Harmonis', description: 'Empati dan peduli sosial.' }
  ];
  
  values.forEach(function(val) {
    var existingList = listRecords(SHEETS.CHARACTER_VALUES, function(item) {
      return item.code === val.code;
    });
    if (existingList.length > 0) return; // Skip if exists
    
    var record = {
      code: val.code,
      name: val.name,
      description: val.description,
      status: STATUS.ACTIVE
    };
    createRecord(SHEETS.CHARACTER_VALUES, record, actor);
  });
  console.log("Character values seeded.");
}

/**
 * Seeds mappings from culture indicators to character values (SAHABAT -> FITRAH).
 * @param {Object} actor
 */
function seedCultureCharacterMappings(actor) {
  var mappings = [
    { cultureCode: 'SSS', characterCode: 'R', sub_character_label: 'Tawadhu & Santun', weight: 1 },
    { cultureCode: 'AM', characterCode: 'I', sub_character_label: 'Teguh dalam Ibadah', weight: 1 },
    { cultureCode: 'HB', characterCode: 'R', sub_character_label: 'Adab & Kepatuhan', weight: 1 },
    { cultureCode: 'ASM', characterCode: 'F', sub_character_label: 'Bernalar Kritis & Literat', weight: 1 },
    { cultureCode: 'BR', characterCode: 'T', sub_character_label: 'Mandiri & Disiplin', weight: 1 },
    { cultureCode: 'AK', characterCode: 'A', sub_character_label: 'Jujur Berkarya Sesuai Syariat', weight: 1 },
    { cultureCode: 'TM', characterCode: 'H', sub_character_label: 'Empati & Peduli Sosial', weight: 1 }
  ];
  
  // Pre-fetch indicators and character values to get their IDs
  var indicators = listRecords(SHEETS.CULTURE_INDICATORS);
  var charValues = listRecords(SHEETS.CHARACTER_VALUES);
  
  var indicatorMap = {};
  indicators.forEach(function(ind) { indicatorMap[ind.code] = ind.id; });
  
  var charValueMap = {};
  charValues.forEach(function(charVal) { charValueMap[charVal.code] = charVal.id; });
  
  mappings.forEach(function(m) {
    var cultureId = indicatorMap[m.cultureCode];
    var characterId = charValueMap[m.characterCode];
    
    if (!cultureId || !characterId) {
      console.warn("Could not find indicator or character code for mapping: " + m.cultureCode + " -> " + m.characterCode);
      return;
    }
    
    // Check if duplicate mapping exists
    var existingList = listRecords(SHEETS.CULTURE_CHARACTER_MAPPINGS, function(item) {
      return item.culture_indicator_id === cultureId && item.character_value_id === characterId;
    });
    if (existingList.length > 0) return; // Skip if exists
    
    var record = {
      culture_indicator_id: cultureId,
      character_value_id: characterId,
      sub_character_label: m.sub_character_label,
      weight: m.weight,
      status: STATUS.ACTIVE
    };
    createRecord(SHEETS.CULTURE_CHARACTER_MAPPINGS, record, actor);
  });
  console.log("Culture-character mappings seeded.");
}
