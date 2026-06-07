module.exports = {
  apps: [
    {
      name: 'realtrackapp-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4191,
      },
      env_file: './backend/.env',
      watch: false,
      max_memory_restart: '1800M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
