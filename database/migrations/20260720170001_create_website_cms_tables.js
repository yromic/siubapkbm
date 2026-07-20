exports.up = async function(knex) {
  // 1. Create assets table
  await knex.schema.createTable("assets", (table) => {
    table.string("id", 36).primary();
    table.string("url", 512).notNullable();
    table.string("alt", 255).notNullable();
    table.string("caption", 512).nullable();
    table.string("title", 255).nullable();
    table.string("mime_type", 100).nullable();
    table.integer("size_bytes").nullable();
    table.timestamps(true, true);
  });

  // 2. Create website_config table
  await knex.schema.createTable("website_config", (table) => {
    table.string("id", 36).primary();
    table.string("school_name", 255).notNullable();
    table.string("short_name", 50).notNullable();
    table.string("tagline", 255).notNullable();
    
    // Media relationships
    table.string("logo_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    table.string("favicon_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    
    // Principal info
    table.string("principal_name", 255).notNullable();
    table.string("principal_title", 255).notNullable();
    table.text("principal_greeting").notNullable();
    table.string("principal_photo_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    
    // Contact & Location info
    table.string("contact_phone_raw", 50).notNullable();
    table.string("contact_phone_display", 50).notNullable();
    table.string("contact_email", 191).notNullable();
    table.string("address_street", 255).notNullable();
    table.string("address_village", 255).notNullable();
    table.string("address_district", 255).notNullable();
    table.string("address_regency", 255).notNullable();
    table.string("address_postal_code", 20).notNullable();
    table.text("maps_embed_url").nullable();
    
    // JSON details
    table.json("social_media").nullable();
    table.json("seo_defaults").nullable();
    table.json("theme_branding").nullable();
    
    table.timestamps(true, true);
  });

  // 3. Create sections table
  await knex.schema.createTable("sections", (table) => {
    table.string("id", 36).primary();
    table.string("type", 50).notNullable();
    table.string("title", 255).nullable();
    table.text("subtitle").nullable();
    table.string("badge", 100).nullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.json("content").nullable();
    
    // Draft / Versioning workflow
    table.boolean("is_draft").notNullable().defaultTo(true);
    table.json("draft_content").nullable();
    table.timestamp("published_at").nullable();
    table.string("updated_by", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("published_by", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
    
    table.timestamps(true, true);
  });

  // 4. Create section_items table
  await knex.schema.createTable("section_items", (table) => {
    table.string("id", 36).primary();
    table.string("section_id", 36).notNullable().references("id").inTable("sections").onDelete("CASCADE");
    table.string("title", 255).nullable();
    table.string("subtitle", 255).nullable();
    table.text("description").nullable();
    table.string("badge", 100).nullable();
    table.string("icon", 100).nullable();
    table.string("image_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.string("link_url", 512).nullable();
    table.string("link_text", 100).nullable();
    table.json("custom_fields").nullable();
    
    table.timestamps(true, true);
  });

  // 5. Create navigation_menus table
  await knex.schema.createTable("navigation_menus", (table) => {
    table.string("id", 36).primary();
    table.string("name", 50).notNullable().unique();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 6. Create navigation_links table
  await knex.schema.createTable("navigation_links", (table) => {
    table.string("id", 36).primary();
    table.string("menu_id", 36).notNullable().references("id").inTable("navigation_menus").onDelete("CASCADE");
    table.string("parent_id", 36).nullable().references("id").inTable("navigation_links").onDelete("CASCADE");
    table.string("label", 100).notNullable();
    table.string("url", 512).notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.string("icon", 100).nullable();
    table.string("target", 20).notNullable().defaultTo("_self");
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("navigation_links");
  await knex.schema.dropTableIfExists("navigation_menus");
  await knex.schema.dropTableIfExists("section_items");
  await knex.schema.dropTableIfExists("sections");
  await knex.schema.dropTableIfExists("website_config");
  await knex.schema.dropTableIfExists("assets");
};
