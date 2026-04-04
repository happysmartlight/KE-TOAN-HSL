module.exports = {
  apps: [
    {
      name: 'ke-toan-backend',
      script: './backend/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'file:./prisma/dev.db',
        JWT_SECRET: 'ke-toan-noi-bo-secret-2024',
      },
      watch: false,
      autorestart: true,
    },
  ],
};
