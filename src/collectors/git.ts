import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const REPOS_DIR = "./repos";

export interface RepoInfo {
  totalFiles: number;
  repoSizeMB: number;
  commitCount: number;
  firstCommitDate: string | null;
  lastCommitDate: string | null;
}

export interface DevelopmentPeriodMetrics {
  periodDays: number;
  commitCount: number;
  authorCount: number;
}

export class GitHandler {
  private repoPath: string;

  constructor(
    private companyName: string,
    private autoCleanup: boolean = false
  ) {
    this.repoPath = "";
  }

  async cloneRepo(githubUrl: string): Promise<string> {
    const repoName =
      githubUrl.split("/").pop()?.replace(".git", "") || this.companyName;
    this.repoPath = path.join(REPOS_DIR, repoName);

    if (!fs.existsSync(REPOS_DIR)) {
      fs.mkdirSync(REPOS_DIR, { recursive: true });
    }

    if (fs.existsSync(this.repoPath)) {
      try {
        await execAsync("git status", { cwd: this.repoPath });
        await execAsync("git fetch --all", { cwd: this.repoPath });
        await execAsync("git reset --hard", { cwd: this.repoPath });
        await execAsync("git clean -fd", { cwd: this.repoPath });
        return this.repoPath;
      } catch {
        fs.rmSync(this.repoPath, { recursive: true, force: true });
      }
    }

    await execAsync(`git clone ${githubUrl} ${this.repoPath}`);
    return this.repoPath;
  }

  async checkoutDate(date: string): Promise<string | null> {
    try {
      try {
        await execAsync(`git checkout main`, { cwd: this.repoPath });
      } catch {
        try {
          await execAsync(`git checkout master`, { cwd: this.repoPath });
        } catch {
          // Continue
        }
      }

      let { stdout } = await execAsync(
        `git log --until="${date}T23:59:59" --format="%H" -1 --all`,
        { cwd: this.repoPath }
      );

      let commitHash = stdout.trim();

      if (!commitHash) {
        const { stdout: afterStdout } = await execAsync(
          `git log --since="${date}T00:00:00" --format="%H" --reverse --all | head -1`,
          { cwd: this.repoPath }
        );
        commitHash = afterStdout.trim();
      }

      if (!commitHash) {
        const { stdout: firstStdout } = await execAsync(
          `git log --format="%H" --reverse --all | head -1`,
          { cwd: this.repoPath }
        );
        commitHash = firstStdout.trim();
      }

      if (!commitHash) {
        throw new Error(`Repository appears to be empty`);
      }

      await execAsync(`git reset --hard`, { cwd: this.repoPath });
      await execAsync(`git clean -fd`, { cwd: this.repoPath });
      await execAsync(`git checkout ${commitHash}`, { cwd: this.repoPath });

      return commitHash;
    } catch {
      return null;
    }
  }

  async analyzeRepository(): Promise<RepoInfo> {
    let totalFiles = 0;
    let repoSizeMB = 0;
    let commitCount = 0;
    let firstCommitDate: string | null = null;
    let lastCommitDate: string | null = null;

    try {
      const { stdout: fileCount } = await execAsync(`find . -type f | wc -l`, {
        cwd: this.repoPath,
      });
      totalFiles = parseInt(fileCount.trim());

      const { stdout: size } = await execAsync(`du -sm .`, {
        cwd: this.repoPath,
      });
      repoSizeMB = parseInt(size.split("\t")[0]!);

      const { stdout: commits } = await execAsync(`git rev-list --count HEAD`, {
        cwd: this.repoPath,
      });
      commitCount = parseInt(commits.trim());

      const { stdout: firstCommit } = await execAsync(
        `git log --reverse --format="%ai" | head -1`,
        { cwd: this.repoPath }
      );
      firstCommitDate = firstCommit.trim().split(" ")[0] || null;

      const { stdout: lastCommit } = await execAsync(
        `git log -1 --format="%ai"`,
        { cwd: this.repoPath }
      );
      lastCommitDate = lastCommit.trim().split(" ")[0] || null;
    } catch {
      // Use defaults
    }

    return {
      totalFiles,
      repoSizeMB,
      commitCount,
      firstCommitDate,
      lastCommitDate,
    };
  }

  async calculateDevelopmentActivity(
    startDate: string,
    endDate: string
  ): Promise<DevelopmentPeriodMetrics> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );

    let commitCount = 0;
    let authorCount = 0;

    try {
      const { stdout: commitOutput } = await execAsync(
        `git rev-list --count --since="${startDate}T00:00:00" --until="${endDate}T23:59:59" --all`,
        { cwd: this.repoPath }
      );
      commitCount = parseInt(commitOutput.trim()) || 0;

      const { stdout: authorOutput } = await execAsync(
        `git log --format="%ae" --since="${startDate}T00:00:00" --until="${endDate}T23:59:59" --all | sort | uniq | wc -l`,
        { cwd: this.repoPath }
      );
      authorCount = parseInt(authorOutput.trim()) || 0;
    } catch {
      // Use defaults
    }

    return {
      periodDays,
      commitCount,
      authorCount,
    };
  }

  cleanup() {
    if (this.autoCleanup && this.repoPath && fs.existsSync(this.repoPath)) {
      fs.rmSync(this.repoPath, { recursive: true, force: true });
    }
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  static cleanAllRepos() {
    if (fs.existsSync(REPOS_DIR)) {
      fs.rmSync(REPOS_DIR, { recursive: true, force: true });
    }
  }

  static listExistingRepos(): string[] {
    if (!fs.existsSync(REPOS_DIR)) {
      return [];
    }
    return fs
      .readdirSync(REPOS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }
}
