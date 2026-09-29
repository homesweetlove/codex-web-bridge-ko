const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const skillDir = path.join(os.homedir(), '.config', 'devin', 'skills', 'github-workflow');
const skillPath = path.join(skillDir, 'SKILL.md');

const SKILL = `---
name: github-workflow
description: Use the signed-in GitHub CLI for repository discovery, private repository access, cloning, issues, pull requests, commits, and explicitly requested pushes.
triggers: ["user", "model"]
---

Use GitHub CLI (gh) and git for GitHub repository work.

1. When the user names an owner/repo, operate on that exact repository.
2. Prefer authenticated commands such as gh repo view, gh repo clone, gh api, gh pr, and gh issue instead of public unauthenticated HTTP lookups.
3. Private repositories are valid targets when the signed-in GitHub account has access.
4. Before changing a repository, inspect its current branch, status, remotes, and relevant files.
5. Make focused changes and run appropriate checks before committing when practical.
6. Commit only changes related to the user's request.
7. Push, create a pull request, merge, delete branches, or perform other remote writes only when the user explicitly requests that remote action.
8. Never display credentials or authentication material.
9. If GitHub CLI is not signed in, explain that gh auth login is required instead of falling back to public-only guesses.
`;

function install() {
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillPath, SKILL, 'utf8');
  return { installed: true, path: skillPath };
}

function status() {
  return { installed: fs.existsSync(skillPath), path: skillPath };
}

function remove() {
  try { fs.unlinkSync(skillPath); } catch {}
  try { fs.rmdirSync(skillDir); } catch {}
  return { installed: false, path: skillPath };
}

module.exports = { install, status, remove, skillPath };
