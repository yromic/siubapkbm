/**
 * Tests.gs
 * QA and verification suite. These functions can be run directly inside
 * the Google Apps Script Editor to test and verify Sprint 1 functionality.
 */

function test_runAllQA() {
  console.log("=== STARTING QA VERIFICATION ===");
  
  test_setupDatabase();
  test_seedInitialData();
  test_loginSuccess();
  test_loginFailureAndLockout();
  test_healthCheck();
  test_userManagementBackend_UM2();
  
  console.log("=== QA VERIFICATION FINISHED ===");
}

/**
 * 1. Test setup_database
 */
function test_setupDatabase() {
  console.log("--- 1. Testing setup_database ---");
  var response = route({ action: 'setup_database', payload: {} });
  var result = JSON.parse(response.getContent());
  console.log("Setup Database Response: " + JSON.stringify(result));
  if (result.status !== 'success') {
    throw new Error("setup_database failed!");
  }
}

/**
 * 2. Test seed_initial_data (Runs twice to verify idempotency)
 */
function test_seedInitialData() {
  console.log("--- 2. Testing seed_initial_data ---");
  
  // Run 1
  var response1 = route({ action: 'seed_initial_data', payload: {} });
  var result1 = JSON.parse(response1.getContent());
  console.log("Seed Run 1 Response: " + JSON.stringify(result1));
  
  // Run 2
  var response2 = route({ action: 'seed_initial_data', payload: {} });
  var result2 = JSON.parse(response2.getContent());
  console.log("Seed Run 2 (Idempotency) Response: " + JSON.stringify(result2));
  
  if (result1.status !== 'success' || result2.status !== 'success') {
    throw new Error("seed_initial_data failed!");
  }
}

/**
 * 3. Test login admin default with correct password
 */
function test_loginSuccess() {
  console.log("--- 3. Testing successful login ---");
  
  var payload = {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Mock-Browser-Test'
  };
  
  var response = route({ action: 'login', payload: payload });
  var result = JSON.parse(response.getContent());
  console.log("Login Success Response: " + JSON.stringify(result));
  
  if (result.status !== 'success') {
    throw new Error("Successful login test failed!");
  }
  
  var user = result.data.user;
  if (user.password_hash) {
    throw new Error("Security breach: password_hash was returned in user response!");
  }
  if (!user.last_login_at) {
    throw new Error("last_login_at was not updated on success login!");
  }
}

/**
 * 4. Test login admin with incorrect password and lockout
 */
function test_loginFailureAndLockout() {
  console.log("--- 4. Testing failed login and lockout ---");
  
  var payload = {
    identifier: 'admin',
    password: 'WrongPassword!',
    ip_address: '127.0.0.1',
    user_agent: 'Mock-Browser-Test'
  };
  
  // Run wrong logins up to LOCKOUT.MAX_ATTEMPTS (5)
  for (var i = 1; i <= 5; i++) {
    console.log("Attempt " + i + " with wrong password...");
    var response = route({ action: 'login', payload: payload });
    var result = JSON.parse(response.getContent());
    console.log("Attempt " + i + " Response: " + JSON.stringify(result));
    
    if (i < 5) {
      if (result.status !== 'error') {
        throw new Error("Wrong login attempt succeeded unexpectedly!");
      }
    } else {
      // 5th attempt should lock the user out
      if (result.status !== 'error' || result.message.indexOf("locked") === -1) {
        throw new Error("Account was not locked out after 5 attempts!");
      }
    }
  }
  
  // Try login again with correct password during lockout duration - should still fail
  console.log("Trying login with correct password during lockout period...");
  var correctPayload = {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Mock-Browser-Test'
  };
  var responseLockCheck = route({ action: 'login', payload: correctPayload });
  var resultLockCheck = JSON.parse(responseLockCheck.getContent());
  console.log("Correct Login During Lockout Response: " + JSON.stringify(resultLockCheck));
  if (resultLockCheck.status !== 'error' || resultLockCheck.message.indexOf("locked") === -1) {
    throw new Error("Correct login succeeded or did not report lockout during active lockout window!");
  }
  
  // Reset lockout manually for developer convenience so future tests pass
  console.log("Manually resetting failed attempts and lockout for further testing...");
  var user = getUserByIdentifier('admin');
  if (user) {
    resetFailedLogin(user);
  }
}

/**
 * 5. Test health check
 */
function test_healthCheck() {
  console.log("--- 5. Testing health check ---");
  var response = route({ action: 'health_check', payload: {} });
  var result = JSON.parse(response.getContent());
  console.log("Health Check Response: " + JSON.stringify(result));
  
  if (result.status !== 'success') {
    throw new Error("health_check failed!");
  }
  if (!result.data.timestamp || !result.data.sprint_version) {
    throw new Error("health_check response is missing timestamp or sprint_version!");
  }
}
