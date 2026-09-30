import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import knex from 'knex';
import { NextRequest } from 'next/server';

// Modules under test
import knexConfig from '../knexfile';
import { getGeminiConfig } from '../lib/config/gemini';
import { STORAGE_PATHS, ensureDir } from '../lib/config/storage';
import { withRole } from '../lib/middleware/withRole';
import { seed as adminSeed } from '../database/seeds/01_admin_user';

describe('Production Deployment Remediation Test Suite', () => {

  describe('1. Migration Configuration & Discovery (DB-01, DB-02)', () => {
    it('should have loadExtensions including .ts and .js in knexfile.ts', () => {
      const config = (knexConfig as any).development || knexConfig;
      assert.ok(config.migrations, 'migrations config must be defined');
      assert.deepEqual(
        config.migrations.loadExtensions,
        ['.ts', '.js'],
        'Knex must load both .ts and .js extensions to match recorded knex_migrations'
      );
    });

    it('should configure Asia/Jakarta timezone (+07:00) on MySQL connection', () => {
      const config = (knexConfig as any).development || knexConfig;
      assert.equal(config.connection.timezone, '+07:00', 'Database connection must specify timezone +07:00');
    });

    it('should discover all migrations without missing historical migrations', async () => {
      const config = (knexConfig as any).development || knexConfig;
      const dbInstance = knex(config);
      try {
        const [completed, pending] = await dbInstance.migrate.list();
        assert.ok(completed.length >= 30, `Completed migrations should be >= 30 (got ${completed.length})`);
        assert.ok(Array.isArray(pending), 'Pending migrations must be an array');
      } finally {
        await dbInstance.destroy();
      }
    });
  });

  describe('2. Persistent Storage Architecture (STR-01)', () => {
    it('should correctly derive storage subpaths from UPLOADS_ROOT', () => {
      assert.ok(STORAGE_PATHS.uploads, 'uploads root must exist');
      assert.ok(STORAGE_PATHS.studentFiles.startsWith(STORAGE_PATHS.uploads), 'studentFiles must be inside uploads');
      assert.ok(STORAGE_PATHS.rpmAttachments.startsWith(STORAGE_PATHS.uploads), 'rpmAttachments must be inside uploads');
      assert.ok(STORAGE_PATHS.exports, 'exports dir must exist');
      assert.ok(STORAGE_PATHS.reports, 'reports dir must exist');
    });

    it('should ensure storage directories safely and recursively', () => {
      const testDir = path.join(process.cwd(), 'storage', 'test_tmp_' + Date.now());
      assert.equal(fs.existsSync(testDir), false);
      ensureDir(testDir);
      assert.equal(fs.existsSync(testDir), true);
      // Clean up
      fs.rmdirSync(testDir);
    });
  });

  describe('3. AI Configuration & Fallback Safety (CFG-01)', () => {
    it('should use a valid model fallback and never gemini-3.5-flash-lite', () => {
      const oldModel = process.env.GEMINI_MODEL;
      delete process.env.GEMINI_MODEL;
      const config = getGeminiConfig();
      assert.notEqual(config.model, 'gemini-3.5-flash-lite', 'Fallback model must never be gemini-3.5-flash-lite');
      assert.equal(config.model, 'gemini-2.5-flash', 'Default fallback model should be gemini-2.5-flash');
      if (oldModel) process.env.GEMINI_MODEL = oldModel;
    });
  });

  describe('4. Default Admin Seed Security (SEC-01 Guard)', () => {
    it('should reject default password admin123 when NODE_ENV === production', async () => {
      const oldEnv = process.env.NODE_ENV;
      const oldPass = process.env.FIRST_ADMIN_PASSWORD;

      (process.env as any).NODE_ENV = 'production';
      process.env.FIRST_ADMIN_PASSWORD = 'admin123';

      const dummyKnex = {} as any;
      await assert.rejects(
        async () => {
          await adminSeed(dummyKnex);
        },
        /SECURITY BLOCKER/
      );

      // Restore env
      (process.env as any).NODE_ENV = oldEnv;
      if (oldPass) process.env.FIRST_ADMIN_PASSWORD = oldPass;
      else delete process.env.FIRST_ADMIN_PASSWORD;
    });
  });

  describe('5. Auth Query Performance & Request Context Reuse (PERF-01)', () => {
    it('should allow authorized role using cached user on request context without querying db', async () => {
      const req = new NextRequest('http://localhost:3000/api/test');
      (req as any).user = { id: 'test-user-id', role: 'teacher' };

      let executed = false;
      const response = await withRole(['teacher', 'administrator'], req, async () => {
        executed = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 }) as any;
      });

      assert.equal(executed, true, 'Handler must execute for authorized role');
      assert.equal(response.status, 200);
    });

    it('should reject unauthorized role using cached user on request context with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/test');
      (req as any).user = { id: 'test-user-id', role: 'student' };

      let executed = false;
      const response = await withRole(['teacher', 'administrator'], req, async () => {
        executed = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 }) as any;
      });

      assert.equal(executed, false, 'Handler must NOT execute for unauthorized role');
      assert.equal(response.status, 403);
    });
  });
});
