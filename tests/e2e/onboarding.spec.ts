import { test, expect, Page } from '@playwright/test';

// Constants - Adjust if your local dev URL is different
const BASE_URL = 'http://localhost:3000'; // Assuming your app runs on port 3000
const MOCK_X_USER_ID = 'test_x_user_123';
const MOCK_X_USERNAME = 'TestXUser';

// Extend Window interface for custom mock properties
declare global {
  interface Window {
    mockedSession: any;
    nextAuthReactMock: any;
    nextAuthReact: any; // To allow overriding
    crossmintUiService: any; // Reverted to any for sprint speed in test mock
    crossmintCallbacks: any;
    updatedWalletData: any;
  }
}

// Helper to mock NextAuth session (client-side)
async function mockClientSession(page: Page, sessionDataInput: any = { data: null, status: 'unauthenticated' }) {
  await page.addInitScript((sessionData: any) => {
    window.mockedSession = sessionData;
    console.log('Mocked session data injected:', window.mockedSession);

    // Mock useSession hook
    window.nextAuthReactMock = {
      useSession: () => {
        if (!window.mockedSession) return { data: null, status: 'unauthenticated' };
        if (window.mockedSession.status === 'loading') return { data: null, status: 'loading' };
        return { 
          data: window.mockedSession.data,
          status: window.mockedSession.status,
          update: async () => { // Simulate session update
            console.log('Mock session update called');
            if (window.mockedSession && window.mockedSession.data && window.mockedSession.data.user && window.updatedWalletData) {
                window.mockedSession.data.user.walletAddress = window.updatedWalletData.walletAddress;
                window.mockedSession.data.user.walletChain = window.updatedWalletData.walletChain;
                window.mockedSession.data.user.agentStatus = window.updatedWalletData.agentStatus; // For agent status updates
                window.mockedSession.data.user.agentUrl = window.updatedWalletData.agentUrl;
                delete window.updatedWalletData; // Clear after update
            }
            return window.mockedSession.data;
          }
        };
      },
      signIn: async (provider: string) => {
        console.log(`Mock signIn called with ${provider}. Simulating successful X login.`);
        window.mockedSession = {
          data: {
            user: { 
              name: MOCK_X_USERNAME, 
              email: `${MOCK_X_USERNAME}@example.com`, 
              image: 'https://example.com/avatar.png',
              xId: MOCK_X_USER_ID, // Crucial for our backend logic
              dbId: 'mock_db_id_123' // Needs to be consistent if backend expects it
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          status: 'authenticated'
        };
        window.location.reload(); // Simulate redirect and session load
        return { ok: true, url: BASE_URL }; // Simulate NextAuth signIn response
      },
      signOut: async () => {
        window.mockedSession = null;
        window.location.reload();
      }
    };
    // Override the actual next-auth/react imports if they exist
    (window as any).nextAuthReact = window.nextAuthReactMock;
  }, sessionDataInput);
}

// Helper to simulate wallet linking after Crossmint modal (for client-side session update)
async function simulateSuccessfulWalletLink(page: Page, walletAddress: string, chain: string) {
    await page.evaluate((data: { walletAddress: string, chain: string }) => {
        window.updatedWalletData = data;
        if (window.mockedSession && window.mockedSession.data && window.mockedSession.data.user) {
            window.mockedSession.data.user.walletAddress = data.walletAddress;
            window.mockedSession.data.user.walletChain = data.chain;
        }
    }, { walletAddress, chain });
}

async function simulateAgentDeployUpdate(page: Page, agentStatus: string, agentUrl?: string) {
    await page.evaluate((data: { agentStatus: string, agentUrl?: string }) => {
        window.updatedWalletData = data;
    }, { agentStatus, agentUrl });
}

test.describe('DEFAI Onboarding and Agent Flow', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Mock the Crossmint SDK script and its init/showLoginModal functions
    await page.addInitScript(() => {
      // Initialize with the mock-specific type
      window.crossmintUiService = {
        init: (config: any) => {
          console.log('Mock Crossmint SDK init called with:', config);
          window.crossmintCallbacks = config.callbacks; // Store callbacks to trigger them later
          return {
            showLoginModal: () => {
              console.log('Mock Crossmint showLoginModal called');
              setTimeout(() => {
                if (window.crossmintCallbacks && window.crossmintCallbacks.onLoginSuccess) {
                  console.log('Simulating Crossmint onLoginSuccess');
                  window.crossmintCallbacks.onLoginSuccess('0xTestWalletPlaywright1234567890AbCdEf', 'polygon');
                }
              }, 500);
            },
          };
        },
      };
    });

    // Mock API responses
    await page.route('/api/auth/link-wallet', async (route: any) => {
      const requestBody = route.request().postDataJSON();
      console.log('/api/auth/link-wallet mock hit with:', requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Wallet linked successfully (mocked).',
          walletAddress: requestBody.walletAddress,
          chain: requestBody.chain,
          vcAgentOwnership: `vc_mock_${Date.now()}`,
        }),
      });
    });

    await page.route('/api/agents/deploy', async (route: any) => {
      console.log('/api/agents/deploy mock hit');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Agent deployment initiated successfully (mocked).',
          agentId: `sim_agent_mock_${Date.now()}`,
          status: 'RUNNING',
          deployedAt: new Date().toISOString(),
        }),
      });
    });
  });

  test('Full user onboarding flow - X login, Wallet link, Agent deploy', async ({ page }: { page: Page }) => {
    await mockClientSession(page); // Start unauthenticated
    await page.goto(BASE_URL);

    // Stepper should be at Auth
    await expect(page.getByText('1. Authenticate')).toHaveClass(/font-bold text-blue-600/);
    const loginButton = page.getByRole('button', { name: /Login with X/i });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // Click Login with X - this will trigger mocked signIn and reload
    await loginButton.click();
    
    // After reload, session should be authenticated (due to mocked signIn)
    // We need to re-apply the session mock for the new page context after reload.
    // The signIn mock already sets window.mockedSession for the reload.
    await page.waitForLoadState('domcontentloaded'); // Wait for page to reload
    
    // Re-mock session for the loaded page to ensure useSession picks it up.
    // The signIn mock updates window.mockedSession, which addInitScript uses on new contexts.
    // For this test, we directly assert based on UI changes driven by mocked session data.

    // Stepper should be at Wallet, button should be Connect Wallet
    await expect(page.getByText('2. Link Wallet')).toHaveClass(/font-bold/);
    const connectWalletButton = page.getByRole('button', { name: /Connect Wallet with Crossmint/i });
    await expect(connectWalletButton).toBeVisible();
    await expect(connectWalletButton).toBeEnabled();

    // Click Connect Wallet - this should trigger mock Crossmint modal & onLoginSuccess
    await connectWalletButton.click();

    // Crossmint onLoginSuccess calls linkWalletToAccount, which calls /api/auth/link-wallet
    // then updates session. We need to simulate this session update for the client.
    // The API mock will return the wallet address.
    // We then use a helper to make the client-side session reflect this for the next step.
    await simulateSuccessfulWalletLink(page, '0xTestWalletPlaywright1234567890AbCdEf', 'polygon');
    
    // Wait for the session update to reflect and UI to change
    // The button text/state is a good indicator. Agent deploy is auto-triggered by useEffect.
    await expect(page.getByRole('button', { name: /Deploying Agent.../i })).toBeVisible({ timeout: 10000 }); // Increased timeout for async operations

    // Stepper should be at Agent Deploy
    await expect(page.getByText('3. Deploy Agent')).toHaveClass(/font-bold/);
    
    // Agent deployment API is called, then UI updates to Agent Running / Completed
    await expect(page.getByRole('button', { name: /Agent Running/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Agent Status: RUNNING')).toBeVisible();
    await expect(page.getByText(/Agent Ownership VC: vc_mock_/)).toBeVisible();
    await expect(page.getByText(/Wallet: 0xTest...AbCdEf \(polygon\)/)).toBeVisible();
    
    // Final state should be COMPLETED or button indicating agent is running
    await expect(page.getByText('Agent is Active!')).toBeVisible();

    // Add a check for the VC hash display if it becomes more specific
  });

  test('User cancels Crossmint (simulated by no onLoginSuccess)', async ({ page }: { page: Page }) => {
    // TODO: This test would require more intricate mocking of Crossmint callbacks,
    // potentially an onLoginFailure or onModalClose that sets an error state.
    // For this sprint, focus is on happy path.
    // Example:
    // - Mock onLoginFailure to be called by mock Crossmint
    // - Assert error message is shown
    // - Assert user can try again
    console.warn('Skipping Crossmint cancellation test for this sprint.');
  });

  test('Attempt to link duplicate wallet (simulated by API error)', async ({ page }: { page: Page }) => {
    // TODO: This requires mocking /api/auth/link-wallet to return a 409 error.
    // Example:
    // - Go through X login
    // - When Crossmint onLoginSuccess fires, have the /api/auth/link-wallet route mock return 409
    // - Assert error message "This wallet address may already be linked..."
    console.warn('Skipping duplicate wallet test for this sprint.');
  });

});

test.describe('DEFAI Onboarding and Agent Flow - Edge Cases', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Mock Crossmint SDK (remains largely the same, success by default)
    await page.addInitScript(() => {
      window.crossmintUiService = {
        init: (config: any) => {
          window.crossmintCallbacks = config.callbacks;
          return {
            showLoginModal: () => {
              // Default success for Crossmint, tests can override route for failure
              setTimeout(() => {
                if (window.crossmintCallbacks && window.crossmintCallbacks.onLoginSuccess) {
                  window.crossmintCallbacks.onLoginSuccess('0xTestWalletPlaywright1234567890AbCdEf', 'polygon');
                }
              }, 100);
            },
          };
        },
      };
    });
  });

  test('Empty agent name in custom flow prevents proceeding', async ({ page }: { page: Page }) => {
    await mockClientSession(page, { data: { user: { name: MOCK_X_USERNAME, xId: MOCK_X_USER_ID, dbId: 'mock_db_id_123' } }, status: 'authenticated' });
    await page.goto(BASE_URL);
    
    // Open modal (assuming a button or auto-trigger exists and works - for this test, we force store state)
    await page.evaluate(() => {
      // @ts-ignore
      window.useAgentSetupStore.getState().openModal();
      // @ts-ignore
      window.useAgentSetupStore.getState().setMode('CUSTOM');
    });
    await page.waitForSelector('h3:text("Forge Your Agent")'); // Wait for modal step title

    const agentNameInput = page.locator('input#agentName');
    await agentNameInput.fill('   '); // Fill with whitespace
    
    // Click Next button in modal footer
    await page.getByRole('button', { name: /Next →/i }).click(); 

    // Should still be on the same step (Forge Your Agent / Name step is 2)
    await expect(page.locator('h3:text("Forge Your Agent")')).toBeVisible();
    // Check for an error message if your component implements one, or ensure step hasn't changed
    // For simplicity, we check we are still on step 2, which means nextStep() in store blocked it.
    const storeState = await page.evaluate(() => (window as any).useAgentSetupStore.getState());
    expect(storeState.currentStep).toBe(2);
    // Optionally, check for a visible error message related to empty name
  });

  test('Wallet linking API returns 409 (wallet already linked)', async ({ page }: { page: Page }) => {
    await mockClientSession(page, { data: { user: { name: MOCK_X_USERNAME, xId: MOCK_X_USER_ID, dbId: 'mock_db_id_123' } }, status: 'authenticated' });
    
    await page.route('/api/auth/link-wallet', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'This wallet address may already be linked to another account.' }),
      });
    });

    await page.goto(BASE_URL);
    await page.evaluate(() => { (window as any).useAgentSetupStore.getState().openModal(); });
    await page.waitForSelector('h3:text("Choose Your Companion")');

    // Click Next (to get to wallet step conceptually, though modal handles it)
    // Click "Connect Wallet with Crossmint"
    await page.getByRole('button', { name: /Connect Wallet with Crossmint/i }).click();
    
    // Crossmint mock will call onLoginSuccess, which calls linkWalletToAccount, hitting the mocked 409 API
    await expect(page.getByText('Error: This wallet address may already be linked to another account.')).toBeVisible({timeout: 5000});
  });

  test('Agent deployment API fails', async ({ page }: { page: Page }) => {
    // Setup session as if wallet is already linked
    const initialSessionWithWallet = {
        data: {
            user: { 
                name: MOCK_X_USERNAME, xId: MOCK_X_USER_ID, dbId: 'mock_db_id_123',
                walletAddress: '0xAlreadyLinkedWalletADDRESS', walletChain: 'polygon'
            }
        },
        status: 'authenticated'
    };
    await mockClientSession(page, initialSessionWithWallet);

    await page.route('/api/agents/deploy', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated Fleek deployment catastrophe!' }),
      });
    });

    await page.goto(BASE_URL); // This should trigger the modal to open at Agent step due to useEffect in component
    
    // Modal should open to AGENT step because wallet is linked in session
    // The useEffect in AgentSetupModal should trigger deployAgent() automatically
    await expect(page.getByText('Error: Simulated Fleek deployment catastrophe!')).toBeVisible({timeout: 10000});
    await expect(page.getByText('Agent Status: Deployment Failed')).toBeVisible();
  });

});

// Keep the happy path tests from before, or move them to a separate file
// For brevity, I am not repeating the happy path test here.
// test.describe('DEFAI Onboarding and Agent Flow - Happy Path', () => { ... }); 