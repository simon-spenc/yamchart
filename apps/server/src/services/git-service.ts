import { simpleGit, SimpleGit } from 'simple-git';

export interface CommitResult {
  success: boolean;
  commit?: string;
  branch?: string;
  noChanges?: boolean;
  error?: string;
}

export interface BranchesResult {
  current: string;
  branches: string[];
}

export class GitService {
  private git: SimpleGit;
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.git = simpleGit(projectDir);
  }

  async getBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  async getBranchesWithCurrent(): Promise<BranchesResult> {
    const result = await this.git.branchLocal();
    return {
      current: result.current,
      branches: result.all,
    };
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.git.branchLocal();
    return result.current;
  }

  async createBranch(name: string, from?: string): Promise<void> {
    if (from) {
      await this.git.checkoutBranch(name, from);
    } else {
      await this.git.checkoutLocalBranch(name);
    }
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  async commitAndPush(message: string): Promise<CommitResult> {
    try {
      // Check for changes
      const status = await this.git.status();

      if (status.files.length === 0) {
        return { success: true, noChanges: true };
      }

      // Stage all changes
      await this.git.add('.');

      // Commit
      const commitResult = await this.git.commit(message);

      // Try to push (may fail if no remote)
      try {
        await this.git.push();
      } catch {
        // Push failed - likely no remote configured, that's ok for local dev
      }

      return {
        success: true,
        commit: commitResult.commit,
        branch: status.current ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return status.files.length > 0;
  }

  async pull(): Promise<void> {
    await this.git.pull();
  }
}
