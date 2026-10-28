# Changelog

All notable changes to this project are documented in this file.

## 0.0.1 - 2026-10-28

Initial independent release of `pi-dchll-qqbot`, forked from `gtiders/pi-agent-qqbot` 1.0.4.

### Added

- Native Pi session linking for one configured QQ C2C owner.
- QQ command keyboards for models, thinking levels, sessions, status, compaction, and turn control.
- Shared terminal and QQ interactions for standard extension dialogs and custom UI.
- Inbound image, voice, document, and file processing.
- Verified local-file delivery through QQ's official chunked-upload protocol.
- Local multi-process Gateway ownership and controlled takeover.

### Changed

- Renamed the npm package, configuration file, runtime identity, and temporary-resource paths to `pi-dchll-qqbot`.
- Initialized the independent package version at 0.0.1.
- Updated package metadata and documentation for the new repository.
- Limited the supported Pi range to `>=1.4.0 <2.0.0` and tested against Pi `1.4.0` only.
- Changed busy-session QQ input from follow-up delivery to native Steering.

### Fixed

- Matched pending QQ prompts independently of the host-reported input source, covering both extension and RPC injection paths.
