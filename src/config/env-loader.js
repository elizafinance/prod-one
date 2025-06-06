import { config } from 'dotenv';

// Load environment variables in order of precedence
export function loadEnvironment() {
  // 1. Load base .env file
  config();
  
  // 2. Load environment-specific file (.env.development, .env.staging, .env.production)
  const nodeEnv = process.env.NODE_ENV || 'development';
  config({ path: `.env.${nodeEnv}` });
  
  // 3. Load local overrides (only in non-production)
  if (nodeEnv !== 'production') {
    config({ path: '.env.local' });
  }
  
  console.log(`[ENV] Loaded configuration for: ${nodeEnv}`);
}

// Call immediately when imported
loadEnvironment(); 