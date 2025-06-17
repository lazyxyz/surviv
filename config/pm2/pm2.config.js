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
        },
        {
            name: 'surviv-api',
            script: 'npm',
            args: 'run start',
            cwd: './packages/surviv-api',
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};