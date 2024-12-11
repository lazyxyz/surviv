module.exports = {
    apps: [
        {
            name: 'game', // Name for the game server app
            script: 'pnpm',
            args: 'start', // Command to start the game server
            watch: false, // Set to true if you want PM2 to restart on file changes
            env: {
                NODE_ENV: 'production', // Set environment variables for production
            },
        },
    ],
};