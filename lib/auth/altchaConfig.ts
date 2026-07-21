/**
 * Validates ALTCHA configuration on startup.
 */
export function validateAltchaConfig() {
  const enabledStr = process.env.ALTCHA_ENABLED;
  if (!enabledStr) {
    throw new Error('ALTCHA_ENABLED is required');
  }
  if (enabledStr !== 'true' && enabledStr !== 'false' && enabledStr !== '1' && enabledStr !== '0') {
    throw new Error('ALTCHA_ENABLED must be a valid boolean string (true/false/1/0)');
  }
  const enabled = enabledStr === 'true' || enabledStr === '1';

  if (enabled) {
    const hmacKey = process.env.ALTCHA_HMAC_KEY;
    if (!hmacKey) {
      throw new Error('ALTCHA_HMAC_KEY is required when ALTCHA is enabled');
    }
    if (hmacKey.length < 32) {
      throw new Error('ALTCHA_HMAC_KEY must be at least 32 characters/bytes for security');
    }

    const difficultyStr = process.env.ALTCHA_DIFFICULTY;
    if (!difficultyStr) {
      throw new Error('ALTCHA_DIFFICULTY is required');
    }
    const difficulty = parseInt(difficultyStr, 10);
    if (isNaN(difficulty) || difficulty <= 0 || difficulty > 10000000) {
      throw new Error('ALTCHA_DIFFICULTY must be a positive integer between 1 and 10,000,000');
    }

    const thresholdStr = process.env.ALTCHA_THRESHOLD;
    if (!thresholdStr) {
      throw new Error('ALTCHA_THRESHOLD is required');
    }
    const threshold = parseInt(thresholdStr, 10);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      throw new Error('ALTCHA_THRESHOLD must be a valid integer between 0 and 100');
    }

    const maxAgeStr = process.env.ALTCHA_MAX_AGE_SECONDS;
    if (!maxAgeStr) {
      throw new Error('ALTCHA_MAX_AGE_SECONDS is required');
    }
    const maxAge = parseInt(maxAgeStr, 10);
    if (isNaN(maxAge) || maxAge <= 0 || maxAge > 86400) {
      throw new Error('ALTCHA_MAX_AGE_SECONDS must be a positive integer between 1 and 86,400 (24 hours)');
    }

    const maxReplayStr = process.env.ALTCHA_MAX_REPLAY_CACHE_SIZE;
    if (!maxReplayStr) {
      throw new Error('ALTCHA_MAX_REPLAY_CACHE_SIZE is required');
    }
    const maxReplay = parseInt(maxReplayStr, 10);
    if (isNaN(maxReplay) || maxReplay <= 0 || maxReplay > 1000000) {
      throw new Error('ALTCHA_MAX_REPLAY_CACHE_SIZE must be a positive integer between 1 and 1,000,000');
    }
  }
}
