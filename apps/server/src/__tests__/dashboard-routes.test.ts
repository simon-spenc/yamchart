import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit } from 'simple-git';
import { dashboardRoutes } from '../routes/dashboards.js';
import { ConfigLoader } from '../services/config-loader.js';
import { GitService } from '../services/git-service.js';

describe('Dashboard Routes', () => {
  let testDir: string;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    testDir = join(tmpdir(), `dashbook-dashboard-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Init git repo
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create dashbook.yaml
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      `
name: test-project
version: "1.0"
`
    );

    // Create dashboard
    await mkdir(join(testDir, 'dashboards'), { recursive: true });
    await writeFile(
      join(testDir, 'dashboards', 'executive.yaml'),
      `
name: executive
title: Executive Overview
layout:
  gap: 16
  rows:
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 12
`
    );

    // Initial commit
    await git.add('.');
    await git.commit('Initial commit');

    // Setup server
    const configLoader = new ConfigLoader(testDir);
    await configLoader.load();

    const gitService = new GitService(testDir);

    app = Fastify();
    await app.register(dashboardRoutes, { configLoader, gitService, projectDir: testDir });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('GET /api/dashboards', () => {
    it('returns list of dashboards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('executive');
      expect(body[0].title).toBe('Executive Overview');
    });
  });

  describe('GET /api/dashboards/:id', () => {
    it('returns dashboard by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards/executive',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('executive');
      expect(body.layout.rows).toHaveLength(1);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/dashboards/:id', () => {
    it('saves dashboard layout and commits', async () => {
      const newLayout = {
        gap: 20,
        rows: [
          { height: 200, widgets: [{ type: 'chart', ref: 'new-chart', cols: 12 }] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/dashboards/executive',
        payload: { layout: newLayout },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.commit).toBeDefined();
    });
  });

  describe('GET /api/git/branches', () => {
    it('returns list of branches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/branches',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.branches).toContain('main');
      expect(body.current).toBe('main');
    });
  });

  describe('POST /api/git/branches', () => {
    it('creates new branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/branches',
        payload: { name: 'feature/test-branch', from: 'main' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
