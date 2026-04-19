# setup-tooling

Install and configure the pre-commit and release toolchain. Run once when initializing the project.

## Install dependencies
```bash
pnpm add -D \
  release-it \
  @release-it/conventional-changelog \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional \
  vitest
```

## Create config files

### `.release-it.json`
```json
{
  "git": {
    "commitMessage": "chore(release): v${version}",
    "tagName": "v${version}",
    "push": true
  },
  "github": {
    "release": true,
    "releaseName": "v${version}"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "conventionalcommits",
      "infile": "CHANGELOG.md",
      "header": "# Changelog"
    }
  }
}
```

### `.commitlintrc.json`
```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "scope-enum": [2, "always", [
      "sales", "inventory", "purchases", "contacts", "accounting", "auth", "core"
    ]],
    "scope-empty": [2, "never"]
  }
}
```

### `.lintstagedrc.json`
```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "bash -c 'tsc --noEmit'"
  ]
}
```

### `package.json` — add scripts
```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "release": "release-it"
  }
}
```

## Init husky and add hooks
```bash
pnpm husky init

# pre-commit: run lint-staged
echo "pnpm lint-staged" > .husky/pre-commit

# commit-msg: enforce conventional commits
echo "pnpm commitlint --edit \$1" > .husky/commit-msg
```

## Verify setup
```bash
# Should reject a bad commit message
echo "bad commit" | pnpm commitlint

# Should accept a good one
echo "feat(sales): add invoice endpoint" | pnpm commitlint
```

## Commit the tooling setup
```bash
git add .
git commit -m "chore(core): add pre-commit hooks and release tooling"
```
