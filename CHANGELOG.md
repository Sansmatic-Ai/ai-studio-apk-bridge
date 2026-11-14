# Changelog

All notable changes are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-14

### Added
- Initial public release by Tamal Mitra.
- Virtual ADB device exposed through `navigator.usb` so AI Studio's
  "Install via USB" can push the APK to the browser instead of a cable.
- Floating "APK Bridge" panel with a Download APK button and a log viewer.
- Fallback loader (`loader.js`) for browsers that ignore `"world": "MAIN"`.
- Extension icon (`icon.png`), which the manifest referenced but was missing.
