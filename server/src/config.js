import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  searchApiKey: process.env.SEARCH_API_KEY,
  searchApiUrl: process.env.SEARCH_API_URL || 'https://api.tavily.com/search',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};
