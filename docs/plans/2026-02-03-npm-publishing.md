# npm Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable `npx dashbook init my-project` by publishing all workspace packages to npm.

**Architecture:** Publish packages in dependency order (@dashbook/schema → @dashbook/auth → @dashbook/query → @dashbook/server → dashbook CLI). Use pnpm's built-in workspace protocol handling which converts `workspace:*` to actual versions on publish. Add GitHub Actions workflow for automated releases.

**Tech Stack:** pnpm publish, GitHub Actions, npm registry, changesets (optional for versioning)

**Prerequisites:** npm account with publish access, `NPM_TOKEN` secret in GitHub repo settings

---

## Publishing Order (Dependency Graph)

```
@dashbook/schema (no deps)
       ↓
@dashbook/auth (no workspace deps)
       ↓
@dashbook/query (depends on schema)
       ↓
@dashbook/server (depends on schema, query, auth)
       ↓
dashbook CLI (depends on schema, query, server)
```

---

## Task 1: Prepare @dashbook/schema for Publishing

**Files:**
- Modify: `packages/schema/package.json`

**Step 1: Update package.json with publish metadata**

Edit `packages/schema/package.json`:
```json
{
  "name": "@dashbook/schema",
  "version": "0.1.0",
  "description": "Zod schemas and TypeScript types for Dashbook",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "https://github.com/simon-spenc/dashbook.git",
    "directory": "packages/schema"
  },
  "keywords": ["dashbook", "schema", "zod", "typescript", "bi", "dashboard"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Key changes:**
- Removed `"private": true`
- Added `license`, `author`, `repository`, `keywords`
- Added `files` array to control published content
- Added `prepublishOnly` script

**Step 2: Verify build works**

```bash
cd packages/schema && pnpm build && ls dist/
```

Expected: `index.js`, `index.d.ts`, and other compiled files

**Step 3: Commit**

```bash
git add packages/schema/package.json
git commit -m "chore(schema): prepare package for npm publishing"
```

---

## Task 2: Prepare @dashbook/auth for Publishing

**Files:**
- Modify: `packages/auth/package.json`

**Step 1: Update package.json**

Edit `packages/auth/package.json`:
```json
{
  "name": "@dashbook/auth",
  "version": "0.1.0",
  "description": "Authentication utilities for Dashbook (Supabase integration)",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "https://github.com/simon-spenc/dashbook.git",
    "directory": "packages/auth"
  },
  "keywords": ["dashbook", "auth", "supabase", "authentication"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    },
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Verify build**

```bash
cd packages/auth && pnpm build && ls dist/
```

**Step 3: Commit**

```bash
git add packages/auth/package.json
git commit -m "chore(auth): prepare package for npm publishing"
```

---

## Task 3: Prepare @dashbook/query for Publishing

**Files:**
- Modify: `packages/query/package.json`

**Step 1: Update package.json**

Edit `packages/query/package.json`:
```json
{
  "name": "@dashbook/query",
  "version": "0.1.0",
  "description": "SQL compilation, templating, and database connectors for Dashbook",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "https://github.com/simon-spenc/dashbook.git",
    "directory": "packages/query"
  },
  "keywords": ["dashbook", "sql", "query", "duckdb", "postgres", "nunjucks"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@dashbook/schema": "workspace:*",
    "nunjucks": "^3.2.4",
    "date-fns": "^4.1.0",
    "duckdb": "^1.1.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/nunjucks": "^3.2.6",
    "@types/pg": "^8.11.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Note:** `workspace:*` will be converted to `^0.1.0` (or actual version) when published.

**Step 2: Verify build**

```bash
cd packages/query && pnpm build && ls dist/
```

**Step 3: Commit**

```bash
git add packages/query/package.json
git commit -m "chore(query): prepare package for npm publishing"
```

---

## Task 4: Prepare @dashbook/server for Publishing

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Update package.json**

Edit `apps/server/package.json`:
```json
{
  "name": "@dashbook/server",
  "version": "0.1.0",
  "description": "Fastify API server for Dashbook dashboards",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "https://github.com/simon-spenc/dashbook.git",
    "directory": "apps/server"
  },
  "keywords": ["dashbook", "server", "fastify", "api", "dashboard"],
  "main": "./dist/exports.js",
  "exports": {
    ".": {
      "types": "./dist/exports.d.ts",
      "import": "./dist/exports.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:prod": "NODE_ENV=production node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@dashbook/auth": "workspace:*",
    "@dashbook/query": "workspace:*",
    "@dashbook/schema": "workspace:*",
    "@fastify/cors": "^10.0.0",
    "@fastify/static": "^8.0.0",
    "chokidar": "^4.0.0",
    "fastify": "^5.2.0",
    "lru-cache": "^11.0.0",
    "simple-git": "^3.30.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/node": "^22.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Verify build**

```bash
cd apps/server && pnpm build && ls dist/
```

**Step 3: Commit**

```bash
git add apps/server/package.json
git commit -m "chore(server): prepare package for npm publishing"
```

---

## Task 5: Prepare dashbook CLI for Publishing

**Files:**
- Modify: `apps/cli/package.json`

**Step 1: Update package.json**

Edit `apps/cli/package.json`:
```json
{
  "name": "dashbook",
  "version": "0.1.0",
  "description": "Git-native business intelligence dashboards - CLI",
  "type": "module",
  "license": "MIT",
  "author": "Simon Spencer",
  "repository": {
    "type": "git",
    "url": "https://github.com/simon-spenc/dashbook.git",
    "directory": "apps/cli"
  },
  "homepage": "https://github.com/simon-spenc/dashbook#readme",
  "keywords": ["dashbook", "cli", "bi", "dashboard", "analytics", "duckdb", "postgres", "sql"],
  "bin": {
    "dashbook": "./bin/dashbook"
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
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@dashbook/query": "workspace:*",
    "@dashbook/schema": "workspace:*",
    "@dashbook/server": "workspace:*",
    "commander": "^12.1.0",
    "dotenv": "^16.4.0",
    "ora": "^8.0.0",
    "picocolors": "^1.1.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Verify build includes templates**

```bash
cd apps/cli && pnpm build && ls -la dist/templates/
```

Expected: `default/` and `empty/` directories with templates

**Step 3: Commit**

```bash
git add apps/cli/package.json
git commit -m "chore(cli): prepare package for npm publishing"
```

---

## Task 6: Add LICENSE File

**Files:**
- Create: `LICENSE`

**Step 1: Create MIT License**

Create `LICENSE` in root:
```
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

## Task 7: Create GitHub Actions Publish Workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create publish workflow**

Create `.github/workflows/publish.yml`:
```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
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

      - name: Build all packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Publish packages
        run: pnpm -r publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow on release"
```

---

## Task 8: Test Local Publishing (Dry Run)

**Files:** None (verification only)

**Step 1: Build all packages**

```bash
pnpm build
```

**Step 2: Test publish dry run for each package**

```bash
cd packages/schema && pnpm publish --dry-run --access public
cd ../auth && pnpm publish --dry-run --access public
cd ../query && pnpm publish --dry-run --access public
cd ../../apps/server && pnpm publish --dry-run --access public
cd ../cli && pnpm publish --dry-run --access public
```

Expected: Each should show what would be published without errors

**Step 3: Verify workspace protocol conversion**

```bash
cd apps/cli && pnpm pack
tar -tzf dashbook-0.1.0.tgz | head -20
tar -xzf dashbook-0.1.0.tgz
cat package/package.json | grep -A5 '"dependencies"'
rm -rf package dashbook-0.1.0.tgz
```

Expected: `workspace:*` should be converted to `^0.1.0`

---

## Task 9: Publish to npm (Manual First Release)

**Files:** None (npm commands)

**Prerequisites:**
- npm account created
- Logged in via `npm login`
- `@dashbook` org created on npm (or use unscoped names)

**Step 1: Create @dashbook org on npm (if needed)**

Go to https://www.npmjs.com/org/create and create `dashbook` org.

**Step 2: Publish in order**

```bash
# Schema first (no deps)
cd packages/schema && pnpm publish --access public

# Auth next (no workspace deps)
cd ../auth && pnpm publish --access public

# Query (depends on schema)
cd ../query && pnpm publish --access public

# Server (depends on schema, query, auth)
cd ../../apps/server && pnpm publish --access public

# CLI last (depends on all)
cd ../cli && pnpm publish --access public
```

**Step 3: Verify installation works**

```bash
# In a temp directory
cd /tmp
rm -rf npm-test
mkdir npm-test && cd npm-test
npm init -y
npx dashbook --version
npx dashbook init my-project
cd my-project
npx dashbook validate
```

Expected: All commands work

**Step 4: Commit version bump (if any)**

```bash
git add -A
git commit -m "chore: publish v0.1.0 to npm"
git tag v0.1.0
git push && git push --tags
```

---

## Task 10: Add NPM_TOKEN Secret to GitHub

**Files:** None (GitHub UI)

**Step 1: Generate npm token**

1. Go to https://www.npmjs.com/settings/tokens
2. Click "Generate New Token" → "Classic Token"
3. Select "Automation" type
4. Copy the token

**Step 2: Add to GitHub**

1. Go to https://github.com/simon-spenc/dashbook/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: (paste token)
5. Click "Add secret"

**Step 3: Test by creating a release**

1. Go to https://github.com/simon-spenc/dashbook/releases/new
2. Create tag `v0.1.0`
3. Title: "v0.1.0 - Initial Release"
4. Publish release
5. Check Actions tab for publish workflow

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Prepare @dashbook/schema | packages/schema/package.json |
| 2 | Prepare @dashbook/auth | packages/auth/package.json |
| 3 | Prepare @dashbook/query | packages/query/package.json |
| 4 | Prepare @dashbook/server | apps/server/package.json |
| 5 | Prepare dashbook CLI | apps/cli/package.json |
| 6 | Add LICENSE | LICENSE |
| 7 | Create publish workflow | .github/workflows/publish.yml |
| 8 | Test dry run | verification |
| 9 | Publish to npm | npm commands |
| 10 | Add NPM_TOKEN secret | GitHub UI |

## Post-Publish Verification

After publishing, verify end-to-end:

```bash
# Clear npm cache
npm cache clean --force

# Test fresh install
cd /tmp && rm -rf final-test
npx dashbook@latest init final-test
cd final-test
npx dashbook dev --no-open &
sleep 3
curl http://localhost:3001/api/health
kill %1
```

Expected: `{"status":"ok","version":"0.1.0",...}`
