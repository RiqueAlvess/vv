module.exports = {
  apps: [
    {
      name: 'vv-worker',
      script: 'npm',
      args: 'run worker',
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-err.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
