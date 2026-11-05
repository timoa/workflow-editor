/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main', 'master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    './.github/scripts/semantic-release-build-vsix.js',
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        // Intentional: no `[skip ci]` suffix. The release commit must
        // trigger CodeQL so SAST scoring covers it (refs TIM-122 —
        // SAST score 24/27). Release-only changes touch CHANGELOG.md
        // and the package.json version bump, both cheap for CodeQL.
        message: 'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['*.vsix'],
      },
    ],
  ],
};
