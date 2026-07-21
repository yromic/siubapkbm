exports.up = async function(knex) {
  // 1. Create faqs table
  await knex.schema.createTable("faqs", (table) => {
    table.string("id", 36).primary();
    table.text("question").notNullable();
    table.text("answer").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. Create testimonials table
  await knex.schema.createTable("testimonials", (table) => {
    table.string("id", 36).primary();
    table.string("name", 255).notNullable();
    table.string("role", 255).nullable();
    table.text("quote").notNullable();
    table.string("avatar_image_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 3. Create gallery_items table
  await knex.schema.createTable("gallery_items", (table) => {
    table.string("id", 36).primary();
    table.string("title", 255).nullable();
    table.text("description").nullable();
    table.string("image_id", 36).nullable().references("id").inTable("assets").onDelete("SET NULL");
    table.string("category", 100).nullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 4. Data Migration - Port existing section items
  const sections = await knex("sections").select("id", "type");
  const items = await knex("section_items").select("*");

  const faqSection = sections.find(s => s.type === "faq");
  const testimonialSection = sections.find(s => s.type === "testimonials");
  const gallerySection = sections.find(s => s.type === "gallery");

  const faqsToInsert = [];
  const testimonialsToInsert = [];
  const galleryToInsert = [];

  for (const item of items) {
    if (faqSection && item.section_id === faqSection.id) {
      faqsToInsert.push({
        id: item.id,
        question: item.title || "Pertanyaan?",
        answer: item.description || "Jawaban",
        sort_order: item.sort_order,
        is_active: true
      });
    } else if (testimonialSection && item.section_id === testimonialSection.id) {
      faqsToInsert.push(); // dummy index, ignore
      testimonialsToInsert.push({
        id: item.id,
        name: item.title || "Anonim",
        role: item.subtitle || "Wali Murid",
        quote: item.description || "",
        avatar_image_id: item.image_id,
        sort_order: item.sort_order,
        is_active: true
      });
    } else if (gallerySection && item.section_id === gallerySection.id) {
      let cat = null;
      if (item.custom_fields) {
        try {
          const parsed = typeof item.custom_fields === "string" ? JSON.parse(item.custom_fields) : item.custom_fields;
          cat = parsed.category || parsed.tag || null;
        } catch (e) {
          // ignore
        }
      }
      galleryToInsert.push({
        id: item.id,
        title: item.title,
        description: item.description,
        image_id: item.image_id,
        category: cat,
        sort_order: item.sort_order,
        is_active: true
      });
    }
  }

  if (faqsToInsert.length > 0) {
    await knex("faqs").insert(faqsToInsert);
  }
  if (testimonialsToInsert.length > 0) {
    await knex("testimonials").insert(testimonialsToInsert);
  }
  if (galleryToInsert.length > 0) {
    await knex("gallery_items").insert(galleryToInsert);
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("gallery_items");
  await knex.schema.dropTableIfExists("testimonials");
  await knex.schema.dropTableIfExists("faqs");
};
