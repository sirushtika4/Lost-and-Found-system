require('dotenv').config();
const database = require('./config/db');
const { loadAuthConfig } = require('./config/auth');
const { createApp } = require('./app');

async function startServer() {
  const config = loadAuthConfig();
  await database.connectDB();
  const app = createApp({ config });
  return app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
}

if (require.main === module) {
  startServer().catch(error => {
    console.error(`Backend startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
