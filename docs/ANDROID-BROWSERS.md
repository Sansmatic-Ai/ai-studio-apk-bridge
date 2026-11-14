# Installing the extension on Android browsers

Regular **Google Chrome for Android, Brave, Opera, Vivaldi, Edge, Samsung Internet
and Firefox do not run Chrome extensions like this one** on Android. You need one
of the Chromium forks below.

> Status last checked: November 2026. Android browsers change quickly, so check
> each browser's own page if something differs.

## Requirement for this extension

- Manifest V3, content scripts on `https://aistudio.google.com/*` and
  `https://ai.studio/*`.
- `"world": "MAIN"` needs Chromium 111 or newer. On older engines the
  extension falls back to `loader.js`, which injects the script after ~0.8 s.
  This can be too late on some pages, so a newer browser is strongly recommended.

## Browser list

| Browser | Chromium-based extensions | Status | Notes |
|---|---|---|---|
| **Titanium Browser** (formerly Helium Browser for Android) | Yes | **Recommended** | Open source (Vanadium/GrapheneOS based). Documented "Load unpacked" and Chrome Web Store support. Google Play + GitHub. |
| **Quetta Browser** | Yes | Good | Chromium-based, advertises access to the Chrome Web Store and Edge Add-ons. Load-unpacked availability varies by version, so test it. |
| **Kiwi Browser** | Yes | **Outdated / discontinued** | Developer archived the project. Old engine. Works for some people, but not recommended. |
| **Lemur Browser** | Yes | Outdated / unmaintained | Based on an old Chromium (about v107). May hit the `loader.js` fallback path. |
| **Relixor** | Yes | Unverified | Kiwi-based fork. Same age concerns as Kiwi. |
| **Yandex Browser** | Partly | Limited | Has its own extension support. Developer-mode unpacked loading is not guaranteed. |
| **Mises Browser** | Reported yes | Unverified | Chromium-based with extension support. Test before relying on it. |
| Chrome, Brave, Edge, Opera, Vivaldi, DuckDuckGo, Samsung Internet | **No** | Not supported | No desktop-style extensions on Android. Samsung Internet has its own add-on store only. |
| Firefox for Android | No (this build) | Not supported | Uses a different add-on system. It would need a separate Firefox build of the extension. |

"Reported" / "Unverified" means I could not confirm it from official docs. Please
test and open an issue to report results.

---

## Step 0: Get the extension onto your phone

1. Download `ai-studio-apk-bridge-extension.zip` (from the GitHub **Releases** page
   or from the `release/` folder).
2. **Unzip it.** Most Android browsers need a *folder*, not a zip.
   - Use the **Files** app (long-press the zip -> Extract) or **ZArchiver**.
   - Put the folder somewhere permanent (e.g. `Download/ai-studio-apk-bridge/`).
     **Do not delete it later**: the browser reads the files from there.
3. Make sure the folder directly contains `manifest.json`.

---

## Titanium Browser (recommended)

1. Install **Titanium Browser** from Google Play, or from the project's GitHub
   releases page (`jqssun/android-titanium-browser`).
2. Open the browser and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Tap **Load unpacked**.
5. In the file picker choose the unzipped `ai-studio-apk-bridge` folder
   (the one with `manifest.json`) and confirm. It can take a few seconds.
6. The extension **AI Studio APK Bridge** appears in the list, enabled.
7. Open `https://aistudio.google.com`. You should see the **APK Bridge** button
   at the bottom right.

## Quetta Browser

1. Install **Quetta Browser** from Google Play.
2. Open the menu and look for **Extensions** (or go to `chrome://extensions`).
3. If you see a **Developer mode** toggle: turn it on and tap **Load unpacked**
   (or **Load**), then pick the unzipped folder.
4. If there is no developer mode, this extension can't be loaded in that
   version. Use Titanium instead, or install via a `.zip`/`.crx` option if your
   version has one.
5. Open `https://aistudio.google.com` and look for the **APK Bridge** button.

## Kiwi Browser (outdated)

1. Install Kiwi (it is no longer maintained, so use at your own risk).
2. Open the menu -> **Extensions** (or `chrome://extensions`).
3. Turn on **Developer mode**.
4. Tap **+ (from .zip/.crx/.user.js)** and choose
   `ai-studio-apk-bridge-extension.zip` **or** use **Load** with the folder.
5. Open AI Studio. If the button appears late, that is the old-engine fallback.

## Lemur / Relixor / Mises / Yandex

Same idea: open the extensions page, enable **Developer mode**, **Load unpacked**,
pick the folder. If your browser has no developer mode, it cannot load a local
extension.

---

## Check that it works

1. Open `https://aistudio.google.com`.
2. You should see **APK Bridge** (bottom right).
3. Open the extension icon/popup: it should say **Extension is installed**.
4. Build an Android app in AI Studio, tap **Install via USB**, then **Download APK**
   in the APK Bridge panel.
5. Open the downloaded `.apk`. If Android blocks it, allow
   **Install unknown apps** for your browser/file manager, then tap **Install**.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Manifest file is missing or unreadable" | You picked the wrong folder. Choose the folder that **directly** contains `manifest.json`. |
| Could not load icon | Use this repo's version (it includes `icon.png`). |
| No "Load unpacked" button | Developer mode is off, or the browser doesn't support local extensions. |
| No APK Bridge button on the page | Reload the page. Make sure the extension is enabled. Site must be `aistudio.google.com` or `ai.studio`. |
| Works only after a refresh | Old engine fallback (`loader.js`). Use Titanium. |
| Extension vanished after moving files | You moved or deleted the folder. Re-load it from its new location. |
| After updating the files nothing changes | Open `chrome://extensions` and tap **Reload** on the extension. |
| Download button missing after "Install via USB" | Open the browser console (desktop remote debugging) and look for `[APK Bridge]` lines, then open a GitHub issue. |
| APK won't install | Allow "Install unknown apps" for the app that opened it. |

## Optional: test on a desktop browser first

Chrome, Edge, Brave, Opera, Vivaldi or Chromium on a PC: open `chrome://extensions`,
enable **Developer mode**, **Load unpacked**, select the `extension/` folder.
