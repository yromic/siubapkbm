import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add deleted_at and deleted_by to classes
  const hasDeletedAtClasses = await knex.schema.hasColumn("classes", "deleted_at");
  if (!hasDeletedAtClasses) {
    await knex.schema.alterTable("classes", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }

  // Add deleted_at and deleted_by to users
  const hasDeletedAtUsers = await knex.schema.hasColumn("users", "deleted_at");
  if (!hasDeletedAtUsers) {
    await knex.schema.alterTable("users", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }

  // Add deleted_at and deleted_by to teacher_profiles
  const hasDeletedAtTeachers = await knex.schema.hasColumn("teacher_profiles", "deleted_at");
  if (!hasDeletedAtTeachers) {
    await knex.schema.alterTable("teacher_profiles", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }

  // Add deleted_at and deleted_by to subjects
  const hasDeletedAtSubjects = await knex.schema.hasColumn("subjects", "deleted_at");
  if (!hasDeletedAtSubjects) {
    await knex.schema.alterTable("subjects", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }

  // Add archived_at, archived_by, deleted_at, and deleted_by to class_teacher_assignments
  const hasArchivedAtAssignments = await knex.schema.hasColumn("class_teacher_assignments", "archived_at");
  if (!hasArchivedAtAssignments) {
    await knex.schema.alterTable("class_teacher_assignments", (table) => {
      table.dateTime("archived_at").nullable();
      table.string("archived_by", 36).nullable();
    });
  }
  const hasDeletedAtAssignments = await knex.schema.hasColumn("class_teacher_assignments", "deleted_at");
  if (!hasDeletedAtAssignments) {
    await knex.schema.alterTable("class_teacher_assignments", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop columns if exist
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
