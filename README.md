# wavevis.aolabs.io

Vite + React + TypeScript tool for programming a 2D grid of double-layer Sarrus cells and inspecting the generated 3D mechanism. The app also includes an Inverse Sheet tab for prescribing a target overhang shape from a flat lattice and measuring the deformation required to reach it.

## Commands

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run deploy`

The public build uses relative asset paths so the same `dist/` output works at `https://wavevis.aolabs.io/` and the temporary `https://aolabs.io/wavevis/` fallback.

Open the Inverse Sheet tab with `?tab=inverse` when a direct link is useful.
