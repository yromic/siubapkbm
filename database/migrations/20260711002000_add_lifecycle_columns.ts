import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add deleted_at and deleted_by to classes
  await knex.schema.alterTable("classes", (table) => {
    table.dateTime("deleted_at").nullable();
    table.string("deleted_by", 36).nullable();
  });

  // Add deleted_at and deleted_by to users
  await knex.schema.alterTable("users", (table) => {
    table.dateTime("deleted_at").nullable();
    table.string("deleted_by", 36).nullable();
  });

  // Add deleted_at and deleted_by to teacher_profiles
  await knex.schema.alterTable("teacher_profiles", (table) => {
    table.dateTime("deleted_at").nullable();
    table.string("deleted_by", 36).nullable();
  });

  // Add deleted_at and deleted_by to subjects
  await knex.schema.alterTable("subjects", (table) => {
    table.dateTime("deleted_at").nullable();
    table.string("deleted_by", 36).nullable();
  });

  // Add archived_at, archived_by, deleted_at, and deleted_by to class_teacher_assignments
  await knex.schema.alterTable("class_teacher_assignments", (table) => {
    table.dateTime("archived_at").nullable();
    table.string("archived_by", 36).nullable();
    table.dateTime("deleted_at").nullable();
    table.string("deleted_by", 36).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("classes", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });

  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });

  await knex.schema.alterTable("teacher_profiles", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });

  await knex.schema.alterTable("subjects", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });

  await knex.schema.alterTable("class_teacher_assignments", (table) => {
    table.dropColumn("archived_at");
    table.dropColumn("archived_by");
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });
}
