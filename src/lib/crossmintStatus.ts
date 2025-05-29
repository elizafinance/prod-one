export const isAuthLoading = (status: string | undefined | null): boolean => {
  if (!status) return false;
  return [
    'connecting',
    'loading-embedded-wallet',
    'loading-wallet-config',
    'initializing'
  ].includes(status);
};

export const isAuthConnected = (status: string | undefined | null): boolean => {
  if (!status) return false;
  return [
    'connected',
    'logged-in' // Added 'logged-in' as a connected state
  ].includes(status);
};

export const isAuthError = (status: string | undefined | null): boolean => {
  if (!status) return false;
  // Check for various error prefixes or exact matches
  return (
    status.startsWith('error') || 
    status === 'requires_mfa' // Considered an "error" in the sense that flow is blocked
  );
}; 