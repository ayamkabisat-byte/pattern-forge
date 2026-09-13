# Contributing to PatternForge

Thanks for helping improve PatternForge. Contributions should keep the project useful as a browser-based, vector-first pattern construction tool.

## Before opening a pull request

1. Check existing issues and pull requests to avoid duplicating work.
2. Keep the change focused on one bug, workflow, or capability when practical.
3. Avoid changing unrelated workspaces while fixing a local problem.
4. Do not add third-party artwork, templates, fonts, or other assets unless their redistribution terms are clear and compatible with the repository.
5. Do not introduce a network upload or external service dependency without making that behavior explicit to users and documenting why it is required.

## Local development

PatternForge expects Node.js 20–22.

```bash
npm install
npm run dev
```

Before submitting:

```bash
npm run build
```

The production build includes TypeScript checking and must pass before a change is ready to merge.

## Pattern-specific verification

For repeat-related changes, test more than the 1×1 master tile. At minimum:

- inspect a 3×3 repeat proof;
- check left/right and top/bottom boundaries;
- test transparent and solid backgrounds when the workspace supports them;
- verify imported SVGs with different viewBox shapes / aspect ratios;
- verify that exported SVG opens independently from the application;
- check that save/reopen preserves editable settings when supported.

For algorithms with seeded randomness, confirm that the same seed remains deterministic.

## Pull request notes

A useful PR description should state:

- the problem being solved;
- the workspace(s) affected;
- how the change was verified;
- whether export or saved-project compatibility changes;
- screenshots or repeat proofs when the change is visual.

If a change intentionally alters existing output, call that out clearly.

## Good first contribution areas

- reproducible repeat-edge regression cases;
- SVG parsing and sanitization hardening;
- accessibility and keyboard behavior;
- responsive layout fixes;
- export validation;
- performance improvements that preserve output;
- documentation and examples.

## Reporting security issues

Please do not disclose a security-sensitive issue in a public ticket. See [SECURITY.md](SECURITY.md).
