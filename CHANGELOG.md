# Changelog

All notable user-facing changes to pi-dchll-qqbot are documented in this file. Versions follow semantic versioning. During the 0.0.x testing stage, features, configuration, and commands may change between releases.

## 0.0.3 - 2026-10-28

### Changed

- Simplified the README around a short project tagline, a three-step quick start, seven core feature summaries, and links to detailed documentation.
- Reduced README density while preserving the bilingual text and the prominent testing-stage notice.
- Moved detailed configuration, troubleshooting, and development information out of the README's main reading flow.

## 0.0.2 - 2026-10-28

### Changed

- Rewrote the README as paired Chinese and English paragraphs with a concise quick-start guide and feature reference.
- Added a prominent bilingual testing-stage notice to the README.

### Fixed

- Assigned shared Steering replies to the latest input origin, preventing QQ replies from being dropped or terminal replies from leaking to QQ.
- Released all QQ resources associated with a shared turn to avoid stale delivery contexts and temporary-resource leaks.

## 0.0.1 - 2026-10-28

Initial independent release of pi-dchll-qqbot, derived from gtiders/pi-agent-qqbot 1.0.4.

### Added

- Native Pi session linking for one configured QQ C2C owner.
- QQ command keyboards for models, thinking levels, sessions, status, compaction, and turn control.
- Shared terminal and QQ interactions for standard extension dialogs and custom UI.
- Inbound image, voice, document, and file processing.
- Verified local-file delivery through QQ's official chunked-upload protocol.
- Local multi-process Gateway ownership and controlled takeover.

### Changed

- Renamed the npm package, configuration file, runtime identity, and temporary-resource paths to pi-dchll-qqbot.
- Limited the supported Pi range to >=1.4.0 <2.0.0 and documented testing against Pi 1.4.0 only.
- Changed busy-session QQ input from follow-up delivery to native Steering.

### Fixed

- Matched pending QQ prompts independently of the host-reported input source, covering both extension and RPC injection paths.
