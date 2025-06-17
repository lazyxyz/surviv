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
            },
        },
        {
            name: 'surviv-api',
            script: 'npm',
            args: 'run start',
            cwd: './surviv-api',
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
            env_development: {
                NODE_ENV: 'development',
                watch: true,
                args: 'run dev',
            },
        },
    ],
};