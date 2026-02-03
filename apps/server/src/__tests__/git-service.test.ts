import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit } from 'simple-git';
import { GitService } from '../services/git-service.js';

describe('GitService', () => {
  let testDir: string;
  let gitService: GitService;

  beforeEach(async () => {
    // Create temp directory with git repo
    testDir = join(tmpdir(), `yamchart-git-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Init git repo
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create initial commit
    await writeFile(join(testDir, 'test.txt'), 'initial');
    await git.add('.');
    await git.commit('Initial commit');

    gitService = new GitService(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getBranches', () => {
    it('returns list of branches', async () => {
      const branches = await gitService.getBranches();
      expect(branches).toContain('main');
    });

    it('includes current branch marker', async () => {
      const result = await gitService.getBranchesWithCurrent();
      expect(result.current).toBe('main');
      expect(result.branches).toContain('main');
    });
  });

  describe('getCurrentBranch', () => {
    it('returns current branch name', async () => {
      const branch = await gitService.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('createBranch', () => {
    it('creates new branch from current', async () => {
      await gitService.createBranch('feature/test');
      const branches = await gitService.getBranches();
      expect(branches).toContain('feature/test');
    });

    it('creates branch from specified base', async () => {
      await gitService.createBranch('feature/from-main', 'main');
      const branches = await gitService.getBranches();
      expect(branches).toContain('feature/from-main');
    });
  });

  describe('checkout', () => {
    it('switches to existing branch', async () => {
      await gitService.createBranch('feature/switch');
      await gitService.checkout('main');
      await gitService.checkout('feature/switch');
      const current = await gitService.getCurrentBranch();
      expect(current).toBe('feature/switch');
    });
  });

  describe('commitAndPush', () => {
    it('commits changes with message', async () => {
      // Modify a file
      await writeFile(join(testDir, 'test.txt'), 'modified');

      const result = await gitService.commitAndPush('Update test file');

      expect(result.success).toBe(true);
      expect(result.commit).toBeDefined();
      expect(result.commit?.length).toBeGreaterThan(0);
    });

    it('handles no changes gracefully', async () => {
      const result = await gitService.commitAndPush('No changes');
      expect(result.success).toBe(true);
      expect(result.noChanges).toBe(true);
    });
  });

  describe('hasUncommittedChanges', () => {
    it('returns false when clean', async () => {
      const hasChanges = await gitService.hasUncommittedChanges();
      expect(hasChanges).toBe(false);
    });

    it('returns true when dirty', async () => {
      await writeFile(join(testDir, 'test.txt'), 'modified');
      const hasChanges = await gitService.hasUncommittedChanges();
      expect(hasChanges).toBe(true);
    });
  });
});
