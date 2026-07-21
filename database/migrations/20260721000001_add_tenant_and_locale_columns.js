exports.up = async function(knex) {
  // 1. Add columns to website_config table
  await knex.schema.alterTable("website_config", (table) => {
    table.string("school_id", 36).nullable().index();
    table.string("locale", 10).notNullable().defaultTo("id").index();
  });

  // 2. Add columns to sections table
  await knex.schema.alterTable("sections", (table) => {
    table.string("school_id", 36).nullable().index();
    table.string("locale", 10).notNullable().defaultTo("id").index();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable("sections", (table) => {
    table.dropColumn("locale");
    table.dropColumn("school_id");
  });

  await knex.schema.alterTable("website_config", (table) => {
    table.dropColumn("locale");
    table.dropColumn("school_id");
  });
};
