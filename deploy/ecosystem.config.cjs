// PM2 process definition — alternative to systemd. Run with:
//   pm2 start deploy/ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup systemd          # follow the printed command to enable on boot
//
// PM2 reads .env from the cwd. The app expects DATABASE_URL, AUTH_SECRET,
// ENCRYPTION_KEY, CRON_SECRET to be set there.

module.exports = {
  apps: [
    {
      name: 'shieldvpn',
      script: '.next/standalone/server.js',
      cwd: '/home/shieldvpn/app',
      // Cluster mode multiplies the process across CPUs; the in-memory
      // rate-limit cache is per-process — swap to a Redis-backed limiter
      // before going wide.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      kill_timeout: 20_000,
      listen_timeout: 30_000,
      wait_ready: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
      out_file: '/var/log/shieldvpn/app.out.log',
      error_file: '/var/log/shieldvpn/app.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
