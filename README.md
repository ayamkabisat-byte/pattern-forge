# PatternForge

**PatternForge is a browser-based vector pattern studio for building, testing, and exporting seamless repeats.**

The project focuses on practical repeat construction rather than image generation: users bring SVG artwork or build geometry in the browser, compose it into mathematically repeatable tiles, inspect the repeat, and export reusable vector assets.

**Live demo:** https://pattern-forge-six.vercel.app

> Status: actively developed preview. The interface currently identifies the active product line as **v2.0 Preview**.

## Why PatternForge

Creating a motif is only one part of surface-pattern work. Production also requires repeat logic, edge wrapping, tile proofing, layout variation, reusable assets, and dependable export. PatternForge brings those workflows into one browser-based tool with an emphasis on editable SVG output and transparent repeat construction.

## Current workspaces

- **Seamless Studio** — freeform and multi-SVG seamless composition.
- **Scattered** — fixed placeholder templates with per-slot artwork, scale, rotation, edge wrapping, master-tile and repeat-proof views.
- **Layout Guides** — frame, strip, diagonal, and structural layout building.
- **Plaid / Tartan** — configurable plaid and tartan construction.
- **Woven / Textile** — template-driven and custom-SVG textile layouts.
- **Pixel Pattern** — editable pixel grids with seamless reuse and scalable vector export.
- **Repeat Layout** — grid, brick, half-drop, hex, multi-tile, and custom repeat arrangements.
- **Directional** — diagonal lanes, rows, strips, and directional textile repeats.
- **Camouflage** — procedural seamless digital and organic region-based patterns.
- **Luxury Pattern** — custom-SVG and geometric lattice / monogram workflows.
- **Scarf / Hijab Studio** — zone-based scarf composition with borders, corners, center treatments, and fold-oriented preview tools.
- **My Patterns** — local reusable pattern and motif library with cross-workspace handoff.

Older experiments remain available under **Legacy** so active production workspaces can evolve without deleting previous approaches.

## Design principles

1. **Seam first.** Repeat correctness should be visible and testable, not hidden behind a preset name.
2. **Vectors stay useful.** SVG workflows should preserve editable geometry wherever the selected operation permits it.
3. **Preview the repeat.** A master tile alone is not enough; repeat-proof views are part of the workflow.
4. **Build with user artwork.** Imported motifs are treated as inputs to a layout system rather than replaced by generated imagery.
5. **Keep workflows composable.** Assets saved in My Patterns can move between compatible builders.
6. **Prefer client-side creative work.** New network-dependent behavior should be explicit and justified.

## Export and project workflows

Depending on the workspace, PatternForge supports combinations of:

- seamless master SVG;
- high-resolution PNG;
- repeat-proof SVG / preview;
- editable PatternForge JSON;
- numbered placeholder or layout guides;
- save / reopen through My Patterns.

Exact export options vary by workspace.

## Tech stack

- React 18
- TypeScript
- Vite
- Browser SVG / Canvas APIs
- Vercel for the public demo
- GitHub Actions for production build verification

The active application entry point is `src/AppV10.tsx`. Historical app versions are retained in `src/` while newer workspaces are increasingly separated into focused components and engines.

## Development

Requirements: Node.js 20–22.

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```

The build command runs TypeScript checking before the Vite production build. GitHub Actions also runs the build on pushes and pull requests targeting `main`.

## Repository structure

```text
src/
  components/       # production workspaces and UI modules
  engine/           # repeat / pattern engines
  AppV10.tsx        # active application shell
  patternLibrary*   # reusable local pattern assets
  exportPresets.ts  # export presets / sizing support
.github/workflows/  # CI build verification
docs/               # implementation and release notes
```

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. For security-sensitive findings, use the process in [SECURITY.md](SECURITY.md) rather than opening a public issue.

Useful contribution areas include repeat-math regression cases, SVG import hardening, export correctness, accessibility, performance, documentation, and small isolated improvements to individual workspaces.

## License

PatternForge is open-source software released under the [MIT License](LICENSE).

## Maintenance

PatternForge is under active development. Changes are intentionally kept reviewable through focused branches / pull requests, production builds, and repeat-specific verification before they are merged into the active app.
