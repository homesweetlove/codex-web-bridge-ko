const github = require('./github-cli.cjs');

function applyGithubEnv(env, settings) {
  env.DEVIN_GITHUB_ENABLED = settings.githubEnabled ? '1' : '0';
  env.DEVIN_GITHUB_WRITE = settings.githubPushEnabled ? '1' : '0';
  const gh = github.resolveBin();
  if (gh) env.DEVIN_GH_BIN = gh;
  return env;
}

module.exports = { applyGithubEnv };
