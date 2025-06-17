module.exports = {
    apps: [
        {
            name: 'surviv',
            script: 'pnpm',
            args: 'start',
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
            env_development: {
                NODE_ENV: 'development',
                watch: true,
                args: 'dev', // Use nodemon for development
            },
        },
    ],
};