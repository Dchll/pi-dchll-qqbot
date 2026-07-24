# Changelog

All notable changes to this project are documented in this file.

## 1.0.1 - 2026-07-24

### Changed

- Rewrote the npm README as a complete bilingual English and Simplified Chinese guide.
- Aligned published Pi peer dependency metadata with Pi Packages discovery requirements.

## 1.0.0 - 2026-07-24

First stable release.

### Added

- Native Pi session linking for one configured QQ C2C owner.
- QQ command keyboards for model, thinking, session, status, compaction, and turn control workflows.
- Shared terminal and QQ interactions for standard `ctx.ui` dialogs.
- Generic remote operation of extension-created `ctx.ui.custom()` components through TUI snapshots, keys, and bracketed-paste text input.
- Inbound image, voice, document, and file processing without extension-level product quotas.
- Verified local-file delivery through QQ's official chunked upload protocol.
- Local multi-process Gateway ownership and controlled takeover.
- Native Windows, macOS, and Linux support.

### Changed

- Configuration schema 5 uses denylist media policy. Empty lists add no product-level restriction.
- Pi and Pi TUI dependencies now declare a compatible release range beginning at 0.82.0; `package-lock.json` retains reproducible development resolution.

### Removed

- Obsolete configuration schemas, migration paths, WSL path translation, legacy runtime implementations, and pre-native-session compatibility behavior.

Pre-1.0 development releases remain available through Git tags `v0.5.0` through `v0.10.0`. Historical design and implementation plans are archived under `docs/archive/` and are not current product documentation.
