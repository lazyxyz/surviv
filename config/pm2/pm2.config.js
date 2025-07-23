module.exports = {
    apps: [
        {
            name: 'surviv',
            script: 'pnpm',
            args: 'start',
            env: { NODE_ENV: 'production' },
            max_memory_restart: '50G', // Restart if RSS exceeds 50GB
            instances: 1, // Single process
            autorestart: true // Restart on crash
        }
    ]
};