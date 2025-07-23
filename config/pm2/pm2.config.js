module.exports = {
  apps: [
    {
      name: 'surviv',
      script: 'pnpm',
      args: 'dev',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '50G',
      autorestart: true,
      exec_mode: 'fork', // Keep cluster mode as per pm2 show
      time: true, // Add timestamps for clarity in console
    },
  ],
};