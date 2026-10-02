[![English](https://img.shields.io/badge/README-English-24292f?style=for-the-badge)](./README.md) [![한국어](https://img.shields.io/badge/README-%ED%95%9C%EA%B5%AD%EC%96%B4-24292f?style=for-the-badge)](./README.ko.md)

# Codex Web Bridge KO

> Upstream project: [miuuyy/codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web)
>
> This repository is not an official OpenAI project. It is an unofficial Korean localization/build layer based on the upstream project and follows its MIT license.

This repository is a Korean-oriented working layer for `codex-chatgpt-web`, intended to help use ChatGPT Web models from a Codex environment.

It is not an official product or distribution of OpenAI, ChatGPT, Codex, Devin, or Cognition. Product and service names remain trademarks of their respective owners.

## What This Repository Adds

- Korean launcher UI
- Korean default language on first run + Korean language option
- Korean/English/Chinese/Japanese language switching in settings
- Korean native UI for tray and uninstall confirmation dialogs
- Korean installation and troubleshooting documentation
- Script that downloads the pinned upstream v5.0.6 source and applies the Korean patch automatically
- GitHub Actions Windows installer build
- Optional separate local proxy integration using the official Devin CLI/ACP

## Important: Web Automation Mode

The automation mode interacts with the ChatGPT website unofficially. Service terms, account policies, UI changes, or usage limits may cause it to stop working or affect the account.

For public distribution or long-term use, consider the `Zero Risk` / manual-interaction mode first, where the user performs input and submission directly. If automation mode is used, review each service's latest terms and account policies.

## Easiest Usage

### Option 1 — Build a Windows Installer with GitHub Actions

1. Open the repository's **Actions** tab.
2. Select **Build Korean Windows Launcher**.
3. Click **Run workflow**.
4. When the build finishes, download the Windows installer from Artifacts.
5. Run the `.exe` installer inside the ZIP.

Bun or Node does not need to be installed separately on the target PC. See the [Windows installation guide](docs/INSTALL-KO.md) for details.

### Option 2 — Run from Source

Prepare the Korean source only:

```powershell
./scripts/bootstrap-ko.ps1
```

If Bun 1.4.0 is installed, prepare the source and launch it in one step:

```powershell
./scripts/bootstrap-ko.ps1 -Run
```

The script downloads the pinned upstream v5.0.6 commit and applies the Korean patch only when the expected source structure matches.

## Usage Flow

1. Launch the Korean launcher.
2. Sign in with your own account inside the launcher.
3. Run the browser-behavior test.
4. Install the model integration.
5. Fully exit the Codex process.
6. Restart Codex while leaving the launcher running.
7. Select the connected Web model from the model picker.

## Interaction Modes

### Zero Risk / Manual Mode

The launcher does not read or manipulate the ChatGPT page. It prepares the prompt, and the user manually pastes it, selects the model/reasoning level/connectors, and submits it.

### Automation Mode

The launcher automatically sends prompts to the ChatGPT page and reads response state. This is convenient, but it is unofficial browser automation, so review the warning above first.

## If Codex Models Do Not Appear

Check the configuration in PowerShell:

```powershell
Get-Content "$env:USERPROFILE\.codex\config.toml"
```

The following entry should exist:

```toml
openai_base_url = "http://127.0.0.1:17841/v1"
```

Do not only close the Codex window; terminate the actual Codex process and relaunch it so the model list refreshes.

See the [Korean troubleshooting guide](docs/TROUBLESHOOTING-KO.md) for more detail.

## Devin Integration

Features under `devin_is_free/` use the official Devin CLI login state and the account's actual entitlement. They do not bypass authentication, usage policy, or model permissions.

See the [Devin integration README](devin_is_free/README.md).

## Upstream Version

Current Korean patch baseline:

- upstream: `miuuyy/codex-chatgpt-web`
- version: `5.0.6`
- commit: `e85e3693fdb4e3e033348c08df0298c20fcdb612`

Upstream details are recorded in [UPSTREAM.md](UPSTREAM.md).

## Security and Privacy

Do not put the following information in issues, commits, logs, screenshots, or the repository:

- ChatGPT/browser session cookies
- API keys and access tokens
- GitHub PAT
- Tunnel IDs and private runtime information
- Account email addresses, school/company account data, or other identifying information
- Full local logs or browser profiles

See [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md) before public release.

## License and Attribution

The upstream project is licensed under MIT. Keep the original copyright notice and license.

This is an unofficial community project and does not imply endorsement or approval by OpenAI or any other mentioned service provider.
