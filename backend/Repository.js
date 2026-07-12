/**
 * Repository.gs
 * Centralized repository layer to ensure thread safety (using LockService)
 * and consistency across database operations. All writes must go through here.
 */

/**
 * Creates a record in a specified sheet under a script lock and logs the creation.
 * @param {string} sheetName - Target sheet name.
 * @param {Object} data - Payload data.
 * @param {Object} [actor] - The user performing the action (optional, for auditing). Contains { id, name, role }.
 * @returns {Object} The created record.
 */
function createRecord(sheetName, data, actor) {
  var lock = LockService.getScriptLock();
  try {
    // Wait for lock up to 10 seconds
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy. Please try again later.");
  }
  
  try {
    // Perform uniqueness/validation if users table
    if (sheetName === SHEETS.USERS) {
      if (data.username) {
        var existingUser = getUserByIdentifier(data.username);
        if (existingUser) {
          throw new Error("Username '" + data.username + "' is already registered.");
        }
      }
      if (data.email) {
        var existingEmail = getUserByIdentifier(data.email);
        if (existingEmail) {
          throw new Error("Email '" + data.email + "' is already registered.");
        }
      }
    }
    
    // Set default lifecycle status if not set
    if (!data.lifecycle_status) {
      var isPeriod = (sheetName === SHEETS.ACADEMIC_YEARS || sheetName === SHEETS.SEMESTERS);
      data.lifecycle_status = isPeriod ? LIFECYCLE_STATUS.DRAFT : LIFECYCLE_STATUS.ACTIVE;
    }
    
    // Write row
    var createdRecord = appendRow(sheetName, data);
    
    // Log creation
    if (sheetName !== SHEETS.AUDIT_LOGS && sheetName !== SHEETS.PARENT_ACCESS_LOGS) {
      try {
        logCreate(sheetName, createdRecord.id, actor, JSON.stringify(createdRecord));
      } catch (auditErr) {
        console.error("Failed to write audit log: " + auditErr.message);
      }
    }
    
    return createdRecord;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates a record in a specified sheet under a script lock and logs the updates.
 * @param {string} sheetName - Target sheet name.
 * @param {string} id - Record ID to update.
 * @param {Object} patch - Fields to update.
 * @param {Object} [actor] - The user performing the action (optional, for auditing).
 * @returns {Object} The updated record.
 */
function updateRecord(sheetName, id, patch, actor) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy. Please try again later.");
  }
  
  try {
    var oldRecord = findRowById(sheetName, id);
    if (!oldRecord) {
      throw new Error("Record not found with ID: " + id + " in sheet: " + sheetName);
    }
    
    // Lifecycle Engine Transition check, Referential Integrity Guard, and metadata generation
    if (patch.lifecycle_status !== undefined) {
      var rawCurrent = oldRecord.lifecycle_status || oldRecord.status || LIFECYCLE_STATUS.ACTIVE;
      var currentStatus = normalizeLifecycleStatus(rawCurrent);
      var targetStatus = normalizeLifecycleStatus(patch.lifecycle_status);
      
      if (currentStatus !== targetStatus) {
        if (targetStatus === 'hard_deleted') {
          if (currentStatus !== 'soft_deleted') {
            throw new Error("Cannot hard delete: record must be in soft_deleted state first.");
          }
          try {
            logUpdate(sheetName, id, actor, JSON.stringify(oldRecord), JSON.stringify({ id: id, lifecycle_status: 'hard_deleted' }));
          } catch (e) {}
          deleteRowById(sheetName, id);
          return { id: id, lifecycle_status: 'hard_deleted' };
        }
        
        if (!isValidTransition(sheetName, currentStatus, targetStatus)) {
          throw new Error("Ilegal status transition: " + currentStatus + " -> " + targetStatus + " in " + sheetName);
        }
        
        // Step 7: Referential Integrity Guard check
        validateRelationGuard(sheetName, id, currentStatus, targetStatus, actor);
        
        // Step 6: Generate metadata patch fields
        var metaPatch = buildLifecyclePatch(sheetName, currentStatus, targetStatus, actor);
        for (var key in metaPatch) {
          patch[key] = metaPatch[key];
        }
      }
    }
    
    var updatedRecord = updateRowById(sheetName, id, patch);
    
    // Step 8: Cascade operations after successful update
    if (patch.lifecycle_status !== undefined && oldRecord.lifecycle_status !== patch.lifecycle_status) {
      try {
        executeLifecycleCascade(sheetName, id, oldRecord.lifecycle_status || LIFECYCLE_STATUS.ACTIVE, patch.lifecycle_status, actor);
      } catch (cascadeErr) {
        console.error("Failed to execute cascade updates: " + cascadeErr.message);
      }
    }
    
    // Log update
    if (sheetName !== SHEETS.AUDIT_LOGS && sheetName !== SHEETS.PARENT_ACCESS_LOGS) {
      try {
        logUpdate(
          sheetName,
          id,
          actor,
          JSON.stringify(oldRecord),
          JSON.stringify(updatedRecord)
        );
      } catch (auditErr) {
        console.error("Failed to write audit log: " + auditErr.message);
      }
    }
    
    return updatedRecord;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieves a single record by its ID.
 * @param {string} sheetName
 * @param {string} id
 * @returns {Object|null}
 */
function getRecordById(sheetName, id) {
  return findRowById(sheetName, id);
}

/**
 * Lists all records matching a filter predicate.
 * @param {string} sheetName
 * @param {Function} [filter] - Predicate function. If omitted, returns all records.
 * @returns {Object[]}
 */
function listRecords(sheetName, filter) {
  if (filter) {
    return findRows(sheetName, filter);
  }
  return readRows(sheetName);
}
