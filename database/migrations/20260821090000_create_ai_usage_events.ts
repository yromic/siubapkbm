import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`ai_usage_events\` (
      \`id\` CHAR(36) NOT NULL,
      \`user_id\` CHAR(36) NULL,
      \`feature\` VARCHAR(50) NOT NULL,
      \`provider\` VARCHAR(50) NOT NULL DEFAULT 'GEMINI',
      \`model\` VARCHAR(100) NOT NULL,
      \`source\` VARCHAR(20) NOT NULL DEFAULT 'GEMINI',
      \`provider_http_status\` INT NULL,
      \`provider_error_reason\` VARCHAR(50) NULL,
      \`duration_ms\` INT NULL,
      \`retry_attempt\` INT NOT NULL DEFAULT 1,
      \`request_started_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_ai_usage_lookup\` (\`provider\`, \`model\`, \`created_at\`),
      INDEX \`idx_ai_usage_created_at\` (\`created_at\`),
      INDEX \`idx_ai_usage_feature\` (\`feature\`),
      INDEX \`idx_ai_usage_user\` (\`user_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `ai_usage_events`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
