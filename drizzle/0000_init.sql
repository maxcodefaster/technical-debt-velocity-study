CREATE TABLE `code_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`funding_round_id` integer,
	`repository_info_id` integer,
	`snapshot_date` text NOT NULL,
	`commit_hash` text NOT NULL,
	`lines_of_code` integer,
	`total_lines` integer,
	`complexity` integer,
	`cognitive_complexity` integer,
	`total_functions` integer,
	`total_classes` integer,
	`total_fields` integer,
	`lack_of_cohesion` integer,
	`total_issues` integer,
	`total_effort_minutes` integer,
	`average_effort_per_issue` real,
	`issues_by_category` text,
	`issues_by_level` text,
	`issues_by_language` text,
	`high_complexity_functions` integer,
	`high_complexity_files` integer,
	`many_parameter_functions` integer,
	`complex_boolean_logic` integer,
	`deeply_nested_code` integer,
	`many_return_statements` integer,
	`total_code_smells` integer,
	`average_complexity` real,
	`max_complexity` integer,
	`analysis_success` integer DEFAULT true,
	`analysis_errors` text,
	`qlty_version` text,
	`analysis_date` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funding_round_id`) REFERENCES `funding_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repository_info_id`) REFERENCES `repository_info`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`github_link` text NOT NULL,
	`market_category` text,
	`exit_state` text DEFAULT 'none',
	`exit_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_name_unique` ON `companies` (`name`);--> statement-breakpoint
CREATE TABLE `development_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`from_round_id` integer,
	`to_round_id` integer,
	`period_days` integer NOT NULL,
	`commit_count` integer,
	`author_count` integer,
	`got_next_round` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_round_id`) REFERENCES `funding_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_round_id`) REFERENCES `funding_rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `funding_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`round_type` text NOT NULL,
	`round_date` text NOT NULL,
	`amount_usd` real,
	`is_extension` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repository_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`analysis_date` text NOT NULL,
	`total_files` integer,
	`repo_size_mb` real,
	`commit_count` integer,
	`first_commit_date` text,
	`last_commit_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
