import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function findGh() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [
    process.env.DEVIN_GH_BIN,
    path.join(programFiles, 'GitHub CLI', 'gh.exe'),
    path.join(local, 'Programs', 'GitHub CLI', 'gh.exe'),
  ].filter(Boolean);
  return candidates.find(file => fs.existsSync(file)) || 'gh';
}

export function enrichGitHubPrompt(text) {
  const gh = findGh();
  const guidance = [
    '[GitHub workflow]',
    `When GitHub access is needed, prefer the GitHub CLI executable: ${gh}`,
    'Use gh repo view, gh repo clone, gh api, gh pr, gh issue, and git commands for repository work.',
    'Private repositories may be available through the signed-in GitHub CLI session.',
    'If the user gives owner/repo, operate on that exact repository.',
    'Only perform push, merge, PR creation, or other remote writes when the user explicitly requests that action.',
    '[/GitHub workflow]',
  ].join('\n');
  return `${guidance}\n\n${text}`;
}
