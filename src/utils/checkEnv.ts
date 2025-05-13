/**
 * Utility to check if required environment variables are set
 */

export function checkRequiredEnvVars() {
  const requiredVars = [
    'NEXT_PUBLIC_SOLANA_RPC_URL',
    'NEXT_PUBLIC_DEFAI_CONTRACT_ADDRESS',
    'NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT',
  ];

  const missingVars = requiredVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`- ${varName}`);
    });
    return false;
  }

  console.log('All required environment variables are set:');
  requiredVars.forEach((varName) => {
    // Mask sensitive values for security
    const value = process.env[varName];
    const maskedValue = value 
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` 
      : 'undefined';
    console.log(`- ${varName}: ${maskedValue}`);
  });
  return true;
} 