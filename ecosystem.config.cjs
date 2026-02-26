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
        PORT: 3191,
      },
      env_file: './backend/.env',
      watch: false,
      max_memory_restart: '500M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'realtrackapp-frontend',
      cwd: './',
      script: 'serve',
      args: 'dist -l tcp://0.0.0.0:4191 -s',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
