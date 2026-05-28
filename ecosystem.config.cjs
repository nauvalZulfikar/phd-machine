/**
 * PM2 ecosystem for career-ops 24/7 mode.
 *
 * Install once:  npm i -g pm2
 * Start all:     pm2 start ecosystem.config.cjs
 * Status:        pm2 ls
 * Logs:          pm2 logs serve   (or pm2 logs cron)
 * Restart:       pm2 restart all
 * Stop:          pm2 stop all
 * Auto-start on reboot:
 *   Windows:     pm2-startup install   (after `npm i -g pm2-windows-startup`)
 *   Linux/Mac:   pm2 startup           (run as root)
 *   Then:        pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'career-ops-serve',
      script: 'auto/serve.mjs',
      cwd: __dirname,
      // Server is light — single instance, auto-restart on crash
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      // Restart if memory > 250 MB (Playwright leaks sometimes)
      max_memory_restart: '250M',
      out_file: 'tmp/pm2-serve-out.log',
      error_file: 'tmp/pm2-serve-err.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        // PORT: '4280',  // uncomment to override
      },
    },
    {
      name: 'career-ops-cron',
      script: 'auto/cron.mjs',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 30000,         // 30s between restarts
      max_memory_restart: '500M',   // larger because spawns playwright
      out_file: 'tmp/pm2-cron-out.log',
      error_file: 'tmp/pm2-cron-err.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta',
        // Score threshold for auto-apply (default 20; 15 unlocks more good-fit roles)
        AUTO_APPLY_THRESHOLD: '15',
        // Set LLM provider if you have a key:
        // ANTHROPIC_API_KEY: 'sk-ant-...',
        // OPENAI_API_KEY: 'sk-...',
        // GEMINI_API_KEY: 'AIza...',
      },
    },
  ],
};
