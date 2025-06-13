import { config } from 'dotenv';

// Detect if we're running in a Next.js context
function isNextJSContext() {
  // Check for Next.js specific environment variables or process context
  return (
    process.env.NEXT_RUNTIME || 
    process.env.__NEXT_PRIVATE_PREBUNDLED_REACT ||
    process.argv.some(arg => arg.includes('next')) ||
    process.title?.includes('next') ||
    typeof window !== 'undefined' // Browser context
  );
}

// Load environment variables in order of precedence
export function loadEnvironment() {
  // Skip loading if we're in a Next.js context to prevent interference
  if (isNextJSContext()) {
    console.log('[ENV] Skipping env-loader in Next.js context (Next.js handles its own env loading)');
    return;
  }
  
  console.log('[ENV] Loading environment variables for background service...');
  
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
  
  // Verify critical environment variables for background services
  const criticalVars = ['MONGODB_URI', 'RABBITMQ_URL'];
  const missingVars = criticalVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('[ENV] WARNING: Missing critical environment variables:', missingVars);
  } else {
    console.log('[ENV] All critical environment variables loaded successfully');
  }
}

// Call immediately when imported
loadEnvironment(); 