interface Config {
  BASE_URL: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
}

const config: Config = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  PORT: parseInt(process.env.PORT || '5000'),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay-system',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key'
};

export default config;
