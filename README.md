# AI Studio APK Bridge

A small Chromium browser extension that lets Google AI Studio's **"Install via USB"**
save the built APK straight to your phone. **No PC. No cable.**

> Created by **Tamal Mitra**. Licensed under the [MIT License](LICENSE).

## How it works

1. On AI Studio pages the extension replaces `navigator.usb` with a *virtual Android
   phone* that speaks the ADB protocol.
2. AI Studio "pushes" the built APK to that virtual phone, just as it would over USB.
3. The extension collects the bytes, builds a real `.apk` file and shows a
   **Download APK** button in a floating **APK Bridge** panel.
4. You open the downloaded file and tap **Install**.

It also has safety nets that catch APK blobs/fetches that look like an APK.

## Requirements

- An Android phone/tablet.
- A Chromium-based Android browser that supports extensions
  (**Titanium**, **Quetta**, etc. See [docs/ANDROID-BROWSERS.md](docs/ANDROID-BROWSERS.md)).
  Regular Chrome for Android does **not** support extensions.
- Permission to install apps from your browser/file manager (Android asks the first time).

## Install (short version)

1. Download the latest `ai-studio-apk-bridge-extension.zip` from the
   [Releases](../../releases) page, or use the `extension/` folder from this repo.
2. Unzip it to a folder on your phone.
3. In your browser open `chrome://extensions`, turn on **Developer mode**,
   tap **Load unpacked**, and pick the folder that contains `manifest.json`.

Full step-by-step guide for each browser: **[docs/ANDROID-BROWSERS.md](docs/ANDROID-BROWSERS.md)**

## Use

1. Open <https://aistudio.google.com> in that browser.
2. Look for the **APK Bridge** button (bottom right).
3. Build your app, then tap **Install via USB**.
4. Tap **Download APK** in the APK Bridge panel.
5. Open the downloaded file and tap **Install**.

## Privacy

No data collection, no network requests of its own. See [PRIVACY.md](PRIVACY.md).

## Project layout

```
extension/   the extension itself (load this folder)
docs/        browser list + install guide, GitHub publishing guide
release/     ready-to-upload extension zip
```

## Disclaimer

This is an independent project. It is **not affiliated with, endorsed by, or
sponsored by Google**. "Google" and "AI Studio" are trademarks of their owners.
The software is provided "as is" without warranty; install only APKs you built
yourself.

## Contributing / Security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Author & license

Copyright (c) 2026 **Tamal Mitra**. Released under the [MIT License](LICENSE).
If you reuse this code, you must keep the copyright notice and license text.
To cite this project, use the "Cite this repository" button on GitHub
(powered by [CITATION.cff](CITATION.cff)).
