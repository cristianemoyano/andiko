# release

Cut a versioned release using `release-it`. Claude orchestrates the flow; the tools do the work.

## Prerequisites (must be installed)
```bash
pnpm add -D release-it @release-it/conventional-changelog husky lint-staged @commitlint/cli @commitlint/config-conventional
```

Config files required at repo root:
- `.release-it.json` (see setup step below)
- `.commitlintrc.json`
- `.husky/commit-msg`
- `.lintstagedrc.json`

If any are missing, run `/setup-tooling` first.

---

## Steps

### 1. Verify develop is ahead of main
```bash
git fetch origin
git log origin/main..origin/develop --oneline
```
If empty → nothing to release. Stop and tell the user.

### 2. Run the test suite on develop
```bash
git checkout develop && git pull origin develop
pnpm test
```
If tests fail → stop. Do not release broken code.

### 3. Create release branch off develop
```bash
git checkout -b release/next origin/develop
```

### 4. Run release-it (does everything)
```bash
pnpm release
```

`release-it` will:
- Prompt for version bump (patch / minor / major)
- Update `package.json`
- Generate / update `CHANGELOG.md` from conventional commits
- Create a git commit `chore(release): vX.Y.Z`
- Create a git tag `vX.Y.Z`
- Push commit + tag to origin

Answer the prompts. Let the tool drive.

### 5. Open PR release/next → main
```bash
gh pr create \
  --base main \
  --title "release: v$(node -p "require('./package.json').version")" \
  --body "$(cat <<'EOF'
## Release

See CHANGELOG.md for full details.

### Pre-merge checklist
- [ ] Tests passing on develop
- [ ] CHANGELOG reviewed
- [ ] Migrations verified against production data copy
- [ ] AFIP/fiscal changes confirmed (if any)
EOF
)"
```

### 6. After PR is merged to main — back-merge into develop
```bash
git checkout develop
git merge main
git push origin develop
```

### 7. Report
Print: version, tag, PR URL.

---

## Guardrails
- Never run `pnpm release` on `main` or `develop` directly — always from `release/*`.
- Never skip the back-merge (step 6).
- If `release-it` fails mid-run, check what was pushed before retrying.
