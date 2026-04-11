import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

try {
  const envExample = dotenv.parse(fs.readFileSync('.env.example'));
  for (const key in envExample) {
    if (key === 'GEMINI_API_KEY' || key === 'APP_URL') continue;
    
    // If the variable is not set, OR if it's REDIS_URL and it's the platform default, override it.
    if (!process.env[key] || (key === 'REDIS_URL' && process.env[key] === 'redis://127.0.0.1:6379')) {
      process.env[key] = envExample[key];
    }
  }
} catch (e) {
  console.warn('Could not load .env.example');
}
