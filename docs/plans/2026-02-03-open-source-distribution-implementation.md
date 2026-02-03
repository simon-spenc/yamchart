# Open Source Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure Yamchart for npm publishing, Docker images, and automated releases via GitHub Actions.

**Architecture:** Monorepo with 4 public npm packages (`yamchart`, `@yamchart/server`, `@yamchart/schema`, `@yamchart/query`) and 3 private packages. Releases triggered by git tags, automated via GitHub Actions.

**Tech Stack:** pnpm workspaces, GitHub Actions, GitHub Container Registry (ghcr.io)

---

### Task 1: Add MIT License

**Files:**
- Create: `LICENSE`

**Step 1: Create LICENSE file**

```text
MIT License

Copyright (c) 2026 Simon Spencer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

### Task 2: Update README

**Files:**
- Modify: `README.md`

**Step 1: Replace all "Dashbook" with "Yamchart" and "dashbook" with "yamchart"**

Update:
- Title: "Dashbook" → "Yamchart"
- All code examples referencing `dashbook` → `yamchart`
- File paths like `dashbook.yaml` → `yamchart.yaml`
- Docker references
- Environment variables like `DASHBOOK_PROJECT_DIR` → `YAMCHART_PROJECT_DIR`

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rename Dashbook to Yamchart in README"
```

---

### Task 3: Configure apps/cli for publishing

**Files:**
- Modify: `apps/cli/package.json`

**Step 1: Update package.json**

The CLI package name stays `yamchart` (no scope for the main CLI). Add publishing metadata:

```json
{
  "name": "yamchart",
  "version": "0.1.0",
  "description": "Git-native business intelligence dashboards",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/simon-spenc/yamchart.git",
    "directory": "apps/cli"
  },
  "homepage": "https://github.com/simon-spenc/yamchart#readme",
  "bugs": {
    "url": "https://github.com/simon-spenc/yamchart/issues"
  },
  "keywords": ["bi", "business-intelligence", "dashboards", "yaml", "sql", "charts", "analytics"],
  "bin": {
    "yamchart": "./bin/yamchart"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "bin"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": { ... },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

**Step 2: Commit**

```bash
git add apps/cli/package.json
git commit -m "chore(cli): configure for npm publishing"
```

---

### Task 4: Configure @yamchart/server for publishing

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Update package.json**

Remove `"private": true` and add publishing metadata:

```json
{
  "name": "@yamchart/server",
  "version": "0.1.0",
  "description": "Yamchart server - Fastify API for Git-native BI dashboards",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/simon-spenc/yamchart.git",
    "directory": "apps/server"
  },
  "homepage": "https://github.com/simon-spenc/yamchart#readme",
  "bugs": {
    "url": "https://github.com/simon-spenc/yamchart/issues"
  },
  "keywords": ["yamchart", "bi", "dashboards", "fastify", "server"],
  "main": "./dist/exports.js",
  "exports": {
    ".": {
      "types": "./dist/exports.d.ts",
      "import": "./dist/exports.js"
    }
  },
  "files": [
    "dist"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": { ... },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

**Step 2: Commit**

```bash
git add apps/server/package.json
git commit -m "chore(server): configure for npm publishing"
```

---

### Task 5: Configure @yamchart/schema for publishing

**Files:**
- Modify: `packages/schema/package.json`

**Step 1: Update package.json**

Remove `"private": true` and add publishing metadata:

```json
{
  "name": "@yamchart/schema",
  "version": "0.1.0",
  "description": "Yamchart Zod schemas and TypeScript types",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/simon-spenc/yamchart.git",
    "directory": "packages/schema"
  },
  "homepage": "https://github.com/simon-spenc/yamchart#readme",
  "bugs": {
    "url": "https://github.com/simon-spenc/yamchart/issues"
  },
  "keywords": ["yamchart", "schemas", "zod", "typescript", "validation"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": { ... },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

**Step 2: Commit**

```bash
git add packages/schema/package.json
git commit -m "chore(schema): configure for npm publishing"
```

---

### Task 6: Configure @yamchart/query for publishing

**Files:**
- Modify: `packages/query/package.json`

**Step 1: Update package.json**

Remove `"private": true` and add publishing metadata:

```json
{
  "name": "@yamchart/query",
  "version": "0.1.0",
  "description": "Yamchart SQL templating and query compilation",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/simon-spenc/yamchart.git",
    "directory": "packages/query"
  },
  "homepage": "https://github.com/simon-spenc/yamchart#readme",
  "bugs": {
    "url": "https://github.com/simon-spenc/yamchart/issues"
  },
  "keywords": ["yamchart", "sql", "nunjucks", "templating", "query"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": { ... },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

**Step 2: Commit**

```bash
git add packages/query/package.json
git commit -m "chore(query): configure for npm publishing"
```

---

### Task 7: Update Dockerfile for Yamchart branding

**Files:**
- Modify: `Dockerfile`

**Step 1: Update Dockerfile**

Replace:
- `dashbook` user/group → `yamchart`
- `DASHBOOK_PROJECT_DIR` → `YAMCHART_PROJECT_DIR`
- Comments referencing "Dashbook"

**Step 2: Commit**

```bash
git add Dockerfile
git commit -m "chore(docker): rename Dashbook to Yamchart"
```

---

### Task 8: Create GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create release workflow**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

  publish-npm:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Publish packages
        run: pnpm -r publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-docker:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  github-release:
    needs: [publish-npm, publish-docker]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

**Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add automated release workflow"
```

---

### Task 9: Verify build works

**Step 1: Run full build**

```bash
pnpm install
pnpm build
```

Expected: All packages build successfully.

**Step 2: Run tests**

```bash
pnpm test
```

Expected: All tests pass.

**Step 3: Verify Docker build**

```bash
docker build -t yamchart:test .
```

Expected: Docker image builds successfully.

---

### Task 10: Document release process

**Files:**
- Modify: `README.md`

**Step 1: Add release instructions section**

Add to README after Development section:

```markdown
## Releasing

Releases are automated via GitHub Actions. To create a release:

1. Update version in all package.json files:
   ```bash
   # Update root and all packages to same version
   pnpm -r exec -- npm version 0.2.0 --no-git-tag-version
   ```

2. Commit and tag:
   ```bash
   git add -A
   git commit -m "chore: release v0.2.0"
   git tag v0.2.0
   git push && git push --tags
   ```

3. GitHub Actions will automatically:
   - Run tests
   - Publish npm packages
   - Build and push Docker image to ghcr.io
   - Create GitHub release with changelog

### Required Secrets

Add `NPM_TOKEN` to your repository secrets (Settings → Secrets → Actions):
- Create token at npmjs.com → Access Tokens → Generate New Token (Automation)
- Token needs publish access to @yamchart organization
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add release instructions"
```
