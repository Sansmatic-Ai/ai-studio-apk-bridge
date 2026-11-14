# Publishing on GitHub and getting proper credit

Replace `YOUR-GITHUB-USERNAME` everywhere with your real GitHub username
(files: `README.md` links are relative, `CITATION.cff` has one URL).

## Why these files give you credit

| File | What it does |
|---|---|
| `LICENSE` (MIT) | Without a license, nobody may legally use your code. MIT lets everyone use it **but they must keep "Copyright (c) 2026 Tamal Mitra" and the license text** in copies. That is your legal credit. |
| License header in `inject.js` / `loader.js` | Your name stays attached even if someone copies one file. |
| `README.md` author section | Visible credit and disclaimer. |
| `CITATION.cff` | GitHub shows a "Cite this repository" button with your name. |
| Git commit history and tagged releases | Dated proof that you published first. |

Honest limits: a license cannot stop copying. It gives you the legal basis to ask
for credit or a takedown if someone removes your notice. MIT also allows commercial
use. If you want different rules, see "Other licenses" at the bottom.

## Option A: Phone-friendly, no commands (GitHub website)

1. Create an account at <https://github.com> and turn on **two-factor
   authentication** (Settings -> Password and authentication).
2. Set your commit name: Settings -> **Profile** -> Name = `Tamal Mitra`.
3. Tap **+** -> **New repository**.
   - Name: `ai-studio-apk-bridge`
   - Description: `Save Google AI Studio APKs straight to your Android phone. No PC or cable.`
   - **Public**, and leave "Add README / .gitignore / license" **unchecked**
     (this package already has them).
   - Create repository.
4. Unzip this package on your phone. In the new empty repo tap
   **uploading an existing file**, and upload the **contents** (all files and
   folders, including the hidden `.github` and `.gitignore` if your file picker
   shows them). Web upload may not take folders on every phone browser. If it
   fails, use Option B.
5. Commit message: `Initial release v1.0.0`, **Commit changes**.

## Option B: Termux (works with your setup)

```bash
pkg update && pkg install git gh -y
git config --global user.name "Tamal Mitra"
git config --global user.email "YOUR-EMAIL-OR-GITHUB-NOREPLY"
gh auth login          # choose GitHub.com, HTTPS, login with browser/token

cd ~/storage/downloads/ai-studio-apk-bridge     # folder you unzipped (run termux-setup-storage once)
git init -b main
git add .
git commit -m "Initial release v1.0.0"
gh repo create ai-studio-apk-bridge --public --source=. --remote=origin --push
```

Tip: use your GitHub **noreply email** (Settings -> Emails -> "Keep my email
addresses private") so your real email isn't published in commits.

## Create the release (the downloadable zip)

Website: repo -> **Releases** -> **Draft a new release**
- Tag: `v1.0.0` (create new tag), Title: `v1.0.0`
- Description: copy the `1.0.0` section from `CHANGELOG.md`
- Attach `ai-studio-apk-bridge-extension-v1.0.0.zip`
- **Publish release**

Termux:

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 ai-studio-apk-bridge-extension-v1.0.0.zip \
  --title "v1.0.0" --notes-file CHANGELOG.md
```

## Keep the zip easy to find

- The versioned zip sits in the repo root, so it shows on the home page.
- Also attach it to every Release (Assets), which is where most people look.
- For each new version: update `version` in `extension/manifest.json`, rebuild the
  zip with the new name (`ai-studio-apk-bridge-extension-vX.Y.Z.zip`), delete the old
  root zip, update the links in `README.md`, add a `CHANGELOG.md` entry, then tag
  and release. Old zips stay available under their old Releases.
- Rebuild command (Termux or Linux):
  `cd extension && zip -r ../ai-studio-apk-bridge-extension-vX.Y.Z.zip . -x '.*'`

## Polish the repo page

- **About** (gear icon): add the description and topics:
  `chromium-extension`, `android`, `apk`, `google-ai-studio`, `webusb`, `adb`.
- Settings -> **Features**: enable **Issues**.
- Settings -> **Security**: enable **Private vulnerability reporting**
  (SECURITY.md refers to it).
- Open `CITATION.cff` on GitHub and make sure the "Cite this repository" box appears.
- Optional: add screenshots to the README (`docs/` folder, `![alt](docs/shot.png)`).

## Protect your credit over time

- Keep the LICENSE and headers intact in every release.
- Tag every release (`v1.0.1`, ...) and add it to `CHANGELOG.md`.
- If someone copies your code without the notice: open an issue or pull request
  politely first. If ignored, use GitHub's DMCA process:
  <https://github.com/contact/dmca>.
- Optional: sign your commits (GitHub docs: "About commit signature verification").

## Other licenses (choose one, don't mix)

| License | Pick it if |
|---|---|
| **MIT** (included) | You want simple and popular: just keep my name. |
| **Apache-2.0** | You also want an explicit patent grant and a NOTICE file for attribution. |
| **GPL-3.0** | Anyone who distributes changes must also open-source them. |
| **AGPL-3.0** | Same as GPL, also covers network use. |

To switch, replace `LICENSE` with the full text from <https://choosealicense.com>
and change the header line in `inject.js`, `loader.js` and `license:` in
`CITATION.cff`. This is general information, not legal advice. For a company
or commercial plans, ask a lawyer.

## Quick checklist

- [ ] Replaced `YOUR-GITHUB-USERNAME` in `CITATION.cff`
- [ ] Repo is public
- [ ] LICENSE visible on repo home (GitHub shows "MIT license")
- [ ] Release `v1.0.0` has the extension zip attached
- [ ] Tested install on at least one Android browser
