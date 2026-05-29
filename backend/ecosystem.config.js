module.exports = {
  apps: [
    {
      name: 'canaricultura-api',
      script: 'server.js',
      cwd: '/var/www/canaricultura/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
