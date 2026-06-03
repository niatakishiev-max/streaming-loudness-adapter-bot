module.exports = {
  apps: [
    {
      name: "loudness-bot",
      script: "telegram_bot.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        UPLOAD_PORT: "8787",
      },
    },
  ],
};
