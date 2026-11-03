# POWER CHART AND BACKTEST

Tauri 2 Windows EXE: charts (lightweight-charts v5.2.1) + DCA/lump-sum backtest for KR/US stocks. Motto: easy and simple, big fonts; powerful but light and fast. The user writes in Korean; UI text is Korean.

- **Start here: [STATUS.md](STATUS.md).** It lists what is done, what is still unverified (live market) and what is pending (open QA bugs). It also has a checklist for an AI reading it after its date: check today's date against the file's date first. Update STATUS.md at the end of each work round.
- The paper-trading clone `FAKE TRADING POWER CHART` ([FAKE_TRADING_기획서.md](FAKE_TRADING_기획서.md), old plan [NEXT_START_HERE.md](NEXT_START_HERE.md)) exists as its own app. 1.3.0 (2026-11-03) brought over everything from it except paper trading. Keep its folder, data, port and key names separate from this app.
- Usage, shortcuts and dev commands: [README.md](README.md). Spec: [SPEC.md](SPEC.md).
- **Yearly maintenance and where the economic data comes from: [MAINTENANCE.md](MAINTENANCE.md).**
  - CPI release dates must be added by hand once a year to `const CPI` in `web/core/events.js`, from the White House OMB "Principal Federal Economic Indicators" PDF.
  - FOMC dates update themselves from federalreserve.gov.
  - Read MAINTENANCE.md before touching FOMC/CPI code. Its "막힌 곳" list says which sources are blocked; don't retry them.

## Working rules
- `web/` is plain ES modules with no bundler. Dev server: `python tools/devserver.py 5180`. Tests: http://localhost:5180/tests/test.html — all must pass. They also import every module, which catches syntax errors that would give the EXE a black screen.
- **Versions and releases: follow [CHANGELOG.md](CHANGELOG.md)** (since 1.0.0 on 2026-10-28).
  - Bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the root package in `src-tauri/Cargo.lock`, and add a CHANGELOG entry.
  - Patch for fixes, minor for features.
- **Source lives in a public GitHub repo (since 2026-11-03).** The user wants only the EXE and the `%APPDATA%` data on their PCs.
  - Work usually happens in a cloud session (claude.ai/code): change, test, commit, push.
  - Release = version bump + CHANGELOG + push a tag `v<version>`. [.github/workflows/build.yml](.github/workflows/build.yml) builds the EXE on GitHub's Windows runner and attaches `POWER-CHART-AND-BACKTEST.exe` to the Release. The tag must equal the `tauri.conf.json` version or the build stops.
  - Since 1.4.0 the app updates itself: it checks GitHub Releases at start and every 12 hours, then downloads, verifies and swaps the EXE, and relaunches. The code is in `src-tauri/src/update.rs` and `web/ui/update.js`. The Release body is the CHANGELOG section for that version, and the app shows it, so write CHANGELOG entries for the user.
  - Updater safety: the repo is a constant in `update.rs`, and JS passes only a version string. The EXE is used only if its SHA-256 and size match the GitHub asset `digest`. Hosts are limited to `ALLOWED_HOSTS` in `update.rs`. These are Rust-only requests, so they are not in `capabilities/default.json`. The dev server only imitates `update_check`.
  - Manual fallback: close the app and replace the EXE with the Release download; data and keys stay.
  - Public repo: never commit keys, logs, market data (`*.db`), backups, or personal names or paths. `.gitignore` covers the files.
  - Cloud sessions have no `tools/dev-data`. Open http://localhost:5180/ once so the watchlist daily bars (QQQ, TQQQ, SQQQ, KRW=X) download before running the tests; the backtest tests need them.
- Local build (only when needed): `cd src-tauri && cargo tauri build --no-bundle`.
  - Then copy `target/release/power-chart-and-backtest.exe` to `release/POWER CHART AND BACKTEST.exe`; the desktop shortcut points there.
  - If that file is running, rename it to `POWER CHART AND BACKTEST.old.exe` first. The app deletes `*.old.exe` on its next start.
  - `target/` is only the build workspace (several GB; GitHub builds leave nothing on the user's PC).
- **Never launch the EXE from Claude Desktop's tools** (no Invoke-Item or Start-Process).
  - Claude Desktop is an MSIX app, so processes it starts get `%APPDATA%` silently redirected to `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\power-chart-and-backtest`. That is a separate, stale copy of the user's data.
  - Ask the user to restart the app from the desktop shortcut instead.
  - To read the user's real log or config from tools, go through the admin share, which bypasses the redirection: `\\localhost\C$\Users\<user>\AppData\Roaming\power-chart-and-backtest\logs\app.log`.
- Every new web host goes in **both** `src-tauri/capabilities/default.json` and `tools/devserver.py` `ALLOWED_HOSTS`.
- Don't edit JS with inline shell heredocs: they turn `\n` inside JS strings into real newlines and break the file. Use an editor tool or a script file with raw strings, then reload the test page.
- Security:
  - No order or trading features.
  - API keys live only in Windows Credential Manager.
  - Alpaca and Toss go only through the read-only Rust allowlist gateways.
  - Don't spoof User-Agents to get past bot blocks.
