import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  githubLink: text("github_link").notNull(),
  marketCategory: text("market_category"),
  exitState: text("exit_state").default("none"),
  exitDate: text("exit_date"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const fundingRounds = sqliteTable("funding_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  roundType: text("round_type").notNull(),
  roundDate: text("round_date").notNull(),
  amountUsd: real("amount_usd"),
  isExtension: integer("is_extension", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const repositoryInfo = sqliteTable("repository_info", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  analysisDate: text("analysis_date").notNull(),
  totalFiles: integer("total_files"),
  repoSizeMB: real("repo_size_mb"),
  commitCount: integer("commit_count"),
  firstCommitDate: text("first_commit_date"),
  lastCommitDate: text("last_commit_date"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const codeSnapshots = sqliteTable("code_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  fundingRoundId: integer("funding_round_id").references(
    () => fundingRounds.id
  ),
  repositoryInfoId: integer("repository_info_id").references(
    () => repositoryInfo.id
  ),
  snapshotDate: text("snapshot_date").notNull(),
  commitHash: text("commit_hash").notNull(),
  linesOfCode: integer("lines_of_code"),
  totalLines: integer("total_lines"),
  complexity: integer("complexity"),
  cognitiveComplexity: integer("cognitive_complexity"),
  totalFunctions: integer("total_functions"),
  totalClasses: integer("total_classes"),
  totalFields: integer("total_fields"),
  lackOfCohesion: integer("lack_of_cohesion"),
  totalIssues: integer("total_issues"),
  totalEffortMinutes: integer("total_effort_minutes"),
  averageEffortPerIssue: real("average_effort_per_issue"),
  issuesByCategory: text("issues_by_category"),
  issuesByLevel: text("issues_by_level"),
  issuesByLanguage: text("issues_by_language"),
  highComplexityFunctions: integer("high_complexity_functions"),
  highComplexityFiles: integer("high_complexity_files"),
  manyParameterFunctions: integer("many_parameter_functions"),
  complexBooleanLogic: integer("complex_boolean_logic"),
  deeplyNestedCode: integer("deeply_nested_code"),
  manyReturnStatements: integer("many_return_statements"),
  totalCodeSmells: integer("total_code_smells"),
  averageComplexity: real("average_complexity"),
  maxComplexity: integer("max_complexity"),
  analysisSuccess: integer("analysis_success", { mode: "boolean" }).default(
    true
  ),
  analysisErrors: text("analysis_errors"),
  qltyVersion: text("qlty_version"),
  analysisDate: text("analysis_date").default(sql`CURRENT_TIMESTAMP`),
});

export const developmentPeriods = sqliteTable("development_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  fromRoundId: integer("from_round_id").references(() => fundingRounds.id),
  toRoundId: integer("to_round_id").references(() => fundingRounds.id),
  periodDays: integer("period_days").notNull(),
  commitCount: integer("commit_count"),
  authorCount: integer("author_count"),
  gotNextRound: integer("got_next_round", { mode: "boolean" }),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  fundingRounds: many(fundingRounds),
  codeSnapshots: many(codeSnapshots),
  developmentPeriods: many(developmentPeriods),
  repositoryInfo: many(repositoryInfo),
}));

export const fundingRoundsRelations = relations(
  fundingRounds,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [fundingRounds.companyId],
      references: [companies.id],
    }),
    codeSnapshots: many(codeSnapshots),
    developmentPeriodsFrom: many(developmentPeriods, {
      relationName: "fromRound",
    }),
    developmentPeriodsTo: many(developmentPeriods, {
      relationName: "toRound",
    }),
  })
);

export const codeSnapshotsRelations = relations(codeSnapshots, ({ one }) => ({
  company: one(companies, {
    fields: [codeSnapshots.companyId],
    references: [companies.id],
  }),
  fundingRound: one(fundingRounds, {
    fields: [codeSnapshots.fundingRoundId],
    references: [fundingRounds.id],
  }),
  repositoryInfo: one(repositoryInfo, {
    fields: [codeSnapshots.repositoryInfoId],
    references: [repositoryInfo.id],
  }),
}));

export const developmentPeriodsRelations = relations(
  developmentPeriods,
  ({ one }) => ({
    company: one(companies, {
      fields: [developmentPeriods.companyId],
      references: [companies.id],
    }),
    fromRound: one(fundingRounds, {
      fields: [developmentPeriods.fromRoundId],
      references: [fundingRounds.id],
      relationName: "fromRound",
    }),
    toRound: one(fundingRounds, {
      fields: [developmentPeriods.toRoundId],
      references: [fundingRounds.id],
      relationName: "toRound",
    }),
  })
);

export const repositoryInfoRelations = relations(
  repositoryInfo,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [repositoryInfo.companyId],
      references: [companies.id],
    }),
    codeSnapshots: many(codeSnapshots),
  })
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type FundingRound = typeof fundingRounds.$inferSelect;
export type NewFundingRound = typeof fundingRounds.$inferInsert;
export type RepositoryInfo = typeof repositoryInfo.$inferSelect;
export type NewRepositoryInfo = typeof repositoryInfo.$inferInsert;
export type CodeSnapshot = typeof codeSnapshots.$inferSelect;
export type NewCodeSnapshot = typeof codeSnapshots.$inferInsert;
export type DevelopmentPeriod = typeof developmentPeriods.$inferSelect;
export type NewDevelopmentPeriod = typeof developmentPeriods.$inferInsert;
