# Neural Resonance v0.9.0

> Historical release notes. v0.10 withdraws the fixed geometries, arbitrary density/dispersion and uncalibrated EEG-to-music rules described below. They are not research-validated results. See [current evidence and methods](EVIDENCE.md).

Neural worm: a shared two-dimensional time trajectory and ten distinct music organization layers.

## Changes

- Default 0–127 coordinates, explicit center at 64, start/end markers, true time order and duration.
- Click a trajectory node or drag the timeline to inspect history; all ten music layers share that selected sample.
- Select a layer to show its organization around the current trajectory point.
- Causal display smoothing is optional. Original measurements, statistics and music controls remain unchanged.
- Trajectory density/dispersion are computed from observed geometry with equal time support; gaps and connection epochs are not joined.
- Each music layer has distinct fixed geometry. Animation changes light only; constant input does not make the node travel.
- Complexity and dispersion controls are separated from pitch, BPM and other music values.
- Optional local 60-second handoff summaries retain measured coverage, provenance, rules and all ten controls.
- Theory and recording requirements are documented in docs/NEURAL-WORM.md.

## Installation

- Windows x64: extract the entire ZIP, then run `NeuralResonance/NeuralResonance.exe`; keep `_internal`.
- Apple Silicon / Intel Mac: extract the matching ZIP and open `Neural Resonance.app`.
- macOS apps are unsigned and not notarized; first launch and Bluetooth access need system permission.
- Native applications bundle Python and dependencies. Existing local acquisition is reused when available.

## Boundaries

Music organization rules are configurable experimental interaction rules, not calibrated emotional or clinical inference. Node networks are music controls, not measured brain connectivity.

Protocol and browser tests do not replace physical hardware verification. Windows software relocation is verified; real Mac USB/BLE acquisition and continuous valid measurements from the current headband/probe remain pending. No private recordings, subject data or personal device configuration are included.
