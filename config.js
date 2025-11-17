module.exports = {
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion',
  sessionSecret: process.env.SESSION_SECRET || 'your_secret_key',
  googleClientID: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
};
