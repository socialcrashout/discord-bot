// Watches the project folder and auto-commits + pushes to GitHub
// any time a file changes, after a short debounce delay.
//
// Setup: npm install chokidar --save-dev
// Run:   node auto-git.js
// Leave this running in its own terminal tab alongside your bot.

const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

const DEBOUNCE_MS = 8000; // wait 8s after the last change before committing
let timer = null;

const watcher = chokidar.watch('.', {
  ignored: [
    /(^|[\/\\])\../, // dotfiles like .git (but .gitignore itself is fine to track)
    'node_modules/**',
    'data/**',
    '.env',
    'auto-git.js',
  ],
  persistent: true,
  ignoreInitial: true,
});

function runGitSync() {
  const timestamp = new Date().toLocaleString();
  const commitMsg = `Auto-update: ${timestamp}`;

  exec('git add .', (err) => {
    if (err) return console.error('git add failed:', err.message);

    exec(`git commit -m "${commitMsg}"`, (err, stdout) => {
      if (err) {
        // "nothing to commit" isn't a real error, just skip quietly
        if (stdout && stdout.includes('nothing to commit')) return;
        console.error('git commit failed:', err.message);
        return;
      }

      exec('git push', (err) => {
        if (err) return console.error('git push failed:', err.message);
        console.log(`✅ Pushed to GitHub — ${timestamp}`);
      });
    });
  });
}

watcher.on('all', (event, filePath) => {
  console.log(`Detected ${event}: ${filePath}`);
  clearTimeout(timer);
  timer = setTimeout(runGitSync, DEBOUNCE_MS);
});

console.log('👀 Watching for file changes... auto-commit + push is active.');