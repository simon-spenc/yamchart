# Open Source Distribution Design

Date: 2026-02-03

## Overview

Set up Yamchart for open source distribution via npm packages, Docker images, and GitHub releases with fully automated CI/CD.

## Package Structure

### Published to npm

| Package | npm name | Purpose |
|---------|----------|---------|
| `apps/cli` | `yamchart` | Main CLI (`npx yamchart init`) |
| `apps/server` | `@yamchart/server` | Fastify server for embedding |
| `packages/schema` | `@yamchart/schema` | Zod schemas for validation/tooling |
| `packages/query` | `@yamchart/query` | SQL templating engine |

### Internal only (not published)

- `packages/config` - shared tsconfig/eslint
- `packages/auth` - cloud-specific
- `packages/billing` - cloud-specific
- `apps/web` - bundled into Docker, not standalone

### Docker image

- `ghcr.io/[github-username]/yamchart` - server + web bundled for self-hosting

## Files to Create

### LICENSE (MIT)

Standard MIT license file at repo root.

### .github/workflows/release.yml

Automated release workflow triggered by `v*` tags:

1. **Validate** - Checkout, install deps, run tests, build
2. **Publish npm** - Publish all public packages to npm
3. **Build Docker** - Multi-arch image (amd64 + arm64)
4. **Push Docker** - Push to ghcr.io with version + latest tags
5. **GitHub Release** - Auto-generate release notes

## Files to Update

### README.md

- Replace all "Dashbook" references with "Yamchart"
- Update install commands to use correct package name

### apps/cli/package.json

Already named `yamchart`. Add:
- `"publishConfig": { "access": "public" }`
- `"repository"`, `"license"`, `"author"`, `"homepage"`, `"bugs"` fields

### apps/server/package.json

Rename to `@yamchart/server`. Add:
- `"publishConfig": { "access": "public" }`
- `"exports"` field for ESM
- `"files"` array
- `"repository"`, `"license"`, `"author"` fields

### packages/schema/package.json

Rename to `@yamchart/schema`. Add:
- `"publishConfig": { "access": "public" }`
- `"exports"` field for ESM
- `"files"` array
- `"repository"`, `"license"`, `"author"` fields

### packages/query/package.json

Rename to `@yamchart/query`. Add:
- `"publishConfig": { "access": "public" }`
- `"exports"` field for ESM
- `"files"` array
- `"repository"`, `"license"`, `"author"` fields

### packages/config/package.json, packages/auth/package.json, packages/billing/package.json

Add `"private": true` to prevent accidental publishing.

## Release Workflow Details

### Trigger

```yaml
on:
  push:
    tags:
      - 'v*'
```

### Required Secrets

- `NPM_TOKEN` - npm automation token with publish access to @yamchart org

### Built-in (no config needed)

- `GITHUB_TOKEN` - for ghcr.io push and GitHub release creation

### Release Process

```bash
# 1. Update version in all package.json files
# 2. Commit changes
git add -A && git commit -m "chore: release v0.2.0"

# 3. Create and push tag
git tag v0.2.0
git push && git push --tags

# GitHub Actions handles the rest
```

## Docker Image Details

### Contents

- Node.js 20 runtime
- Built server (`apps/server/dist`)
- Built web assets (`apps/web/dist`)
- Entrypoint runs server

### Usage

```bash
docker run -p 8080:8080 \
  -v ./my-yamchart-project:/app/project \
  ghcr.io/[username]/yamchart
```

### Architecture Support

- `linux/amd64` - Standard Intel/AMD servers
- `linux/arm64` - AWS Graviton, Apple Silicon

## Implementation Checklist

- [ ] Add LICENSE file (MIT)
- [ ] Update README.md (Dashbook → Yamchart)
- [ ] Update apps/cli/package.json with publish config
- [ ] Update apps/server/package.json (rename + publish config)
- [ ] Update packages/schema/package.json (rename + publish config)
- [ ] Update packages/query/package.json (rename + publish config)
- [ ] Mark packages/config as private
- [ ] Mark packages/auth as private
- [ ] Mark packages/billing as private
- [ ] Create .github/workflows/release.yml
- [ ] Verify existing Dockerfile works
- [ ] Update pnpm-workspace.yaml if needed
- [ ] Test local build
- [ ] Document NPM_TOKEN secret setup in README or CONTRIBUTING
