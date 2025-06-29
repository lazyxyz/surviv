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
        }
    ],
};