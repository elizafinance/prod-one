# User Engagement & Rewards Platform

This platform is designed to foster user engagement through a points-based reward system, referral program, and social media interaction tracking. It integrates with X (formerly Twitter) for authentication and allows users to earn points for various activities.

![WebUI Preview](./template-image.jpg)

## Core Featuressssssssss

*   **User Authentication:** Secure sign-up and login using X (Twitter) accounts via NextAuth.js.
*   **Points System:** Users earn points for actions like initial connection, social sharing, following, airdrop eligibility, and referrals.
*   **Referral Program:** Users can refer others and earn bonus points.
*   **Social Engagement Tracking:** Logs actions such as sharing content or following on X.
*   **Airdrop Rewards:** Calculates and assigns points based on predefined airdrop criteria.
*   **Leaderboard:** Displays top users based on accumulated points.
*   **Dark/Light Mode:** Theme support for user preference.
*   **(If Applicable) Escrow Management:** Interface for managing token escrow settings, viewing balances, and assets held (accessible via `/escrow`).

## Tech Stack

*   **Frontend Framework:** Next.js (React)
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn
*   **State Management:** Zustand
*   **Authentication:** NextAuth.js
*   **Database:** MongoDB
*   **Solana Integration:** Solana WalletAdapter, Metaplex Umi (for blockchain interactions if applicable to escrow features)

## Getting Started

Follow these steps to get the platform running locally.

### 1. Prerequisites

*   Node.js (v18.x or later recommended)
*   npm (or yarn)

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/your-repository-name.git
cd your-repository-name
```
*(Replace with the actual repository URL if different from the example used in the original README)*

### 3. Environment Variable Setup

This is a critical step for the application to function correctly. Rename the `.env.example` file to `.env.local` in the root of your project and fill in the following values:

```shell
# MongoDB Connection (Required for all user data, points, referrals, etc.)
MONGODB_URI="your_mongodb_connection_string"
MONGODB_DB_NAME="your_mongodb_database_name"

# X (Twitter) OAuth Credentials (Required for user login)
# Create an app at https://developer.twitter.com/en/portal/projects-and-apps
X_CLIENT_ID="your_x_app_client_id"
X_CLIENT_SECRET="your_x_app_client_secret"

# NextAuth.js Secret (Required for session security)
# Generate a secret: `openssl rand -base64 32`
NEXTAUTH_SECRET="your_nextauth_secret"

# Solana RPC URL (Required if using Solana blockchain features)
NEXT_PUBLIC_RPC="https://your-solana-rpc-url"

# Escrow Configuration (If applicable to your platform's features)
# These are typically addresses on the Solana blockchain.
NEXT_PUBLIC_ESCROW="escrow_account_public_key"
NEXT_PUBLIC_COLLECTION="collection_public_key_if_applicable"
NEXT_PUBLIC_TOKEN="token_mint_public_key_if_applicable"

# Optional: Specify the full URL for your application in production
# NEXTAUTH_URL="https://yourdomain.com"
```

**Explanation of Environment Variables:**

*   `MONGODB_URI`: Your full MongoDB connection string.
*   `MONGODB_DB_NAME`: The name of the database to use within your MongoDB instance.
*   `X_CLIENT_ID` & `X_CLIENT_SECRET`: Credentials from your X (Twitter) Developer App for OAuth authentication.
*   `NEXTAUTH_SECRET`: A random string used to hash tokens and cookies for NextAuth.js.
*   `NEXT_PUBLIC_RPC`: The URL of the Solana RPC endpoint you want to connect to for any blockchain interactions.
*   `NEXT_PUBLIC_ESCROW`, `NEXT_PUBLIC_COLLECTION`, `NEXT_PUBLIC_TOKEN`: Solana public keys related to the token escrow functionality, if used.
*   `NEXTAUTH_URL`: The canonical URL of your deployed application. Important for NextAuth.js redirects, especially in production.

### 4. Install Dependencies

```bash
npm install
```
or if you use yarn:
```bash
yarn install
```

### 5. Run the Development Server

```bash
npm run dev
```
The application should now be running at `http://localhost:3000`.

## Build & Deployment

### Build Command

To create an optimized production build, run:

```bash
npm run build
```

### Deployment Notes

*   **CRITICAL: Environment Variables:** Ensure all the environment variables listed in the `.env.local` section above are correctly configured in your deployment platform's settings (e.g., Vercel, Netlify, AWS Amplify, Docker environment). The build will fail or the application will not run correctly without them, especially `MONGODB_URI`, `MONGODB_DB_NAME`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, and `NEXTAUTH_SECRET`.
*   **Database Accessibility:** Make sure your deployment environment can access your MongoDB instance (e.g., firewall rules, IP whitelisting if your database is not publicly accessible).
*   **Browserslist:** If you see a warning during the build like `Browserslist: caniuse-lite is outdated`, you can update it by running:
    ```bash
    npx update-browserslist-db@latest
    ```
    Then, commit the changes to your `package-lock.json` or `yarn.lock` file.
*   **NEXTAUTH_URL:** For production deployments, it is highly recommended to set the `NEXTAUTH_URL` environment variable to the canonical URL of your application.

## (Optional) Escrow Management

If your platform includes token escrow functionalities, you may be able to manage the escrow settings by navigating to the `/escrow` path in your application. This section typically allows for:
*   Viewing an overview of escrow settings.
*   Editing and updating escrow parameters.
*   Checking token balances held in escrow.
*   Viewing Core NFT Assets associated with the escrow.

## (Optional) Customization

### Image Replacement
The template might use placeholder images for collection art or token icons. These can typically be found and replaced in the `src/assets/images/` directory (e.g., `collectionImage.jpg`, `token.jpg`).

## Governance and Proposal System

This project includes a squad-based governance system allowing leaders to create token reward proposals, and for squad members to vote on them.

### Key Features

*   **Proposal Creation:** Squad leaders with sufficient points can create proposals.
*   **Voting:** Squad members can vote (up, down, abstain) with their points acting as vote weight.
*   **Proposal Lifecycle:** Proposals are active, then processed to be `closed_passed`, `closed_failed`, or `closed_executed`, and eventually `archived`.
*   **Notifications:** Users receive notifications for new proposals and proposal results.
*   **Progress Display:** Proposal cards show progress towards quorum and approval.

### Environment Variables (Proposal System)

In addition to the core environment variables, the following are used for the proposal and voting system. Ensure they are set in your `.env.local` file and deployment environment:

#### Frontend (NEXT_PUBLIC_)
*   `NEXT_PUBLIC_SQUAD_POINTS_TO_CREATE_PROPOSAL=10000` - Minimum squad points for a leader to create a proposal.
*   `NEXT_PUBLIC_MIN_POINTS_TO_VOTE=500` - Minimum DeFAI points a user needs to vote.
*   `NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD=1000` - Points threshold (sum of upvote weights) for a proposal to be marked "broadcasted".
*   `NEXT_PUBLIC_PROPOSALS_PER_PAGE=10` - Number of proposals to show per page on the proposals list.
*   `NEXT_PUBLIC_PROPOSALS_REFRESH_INTERVAL=30000` - Interval in milliseconds for polling active proposals (e.g., 30000 for 30s).
*   `NEXT_PUBLIC_PROPOSAL_QUORUM_VOTERS_TARGET=10` - UI target for number of voters for quorum progress bar.
*   `NEXT_PUBLIC_PROPOSAL_QUORUM_WEIGHT_TARGET=5000` - UI target for total engaged weight for quorum progress bar.
*   `NEXT_PUBLIC_PROPOSAL_PASS_NET_WEIGHT_TARGET=1000` - UI target for net positive vote weight for "approval strength" progress bar.

#### Backend / Cron (Server-side only)
*   `CRON_PROPOSAL_PASS_THRESHOLD=0` - Net vote weight (upWeight - downWeight) above which a proposal is considered passed by the cron job.
*   `CRON_PROPOSAL_ARCHIVE_DELAY_DAYS=7` - Number of days after a proposal is closed before it's archived by the cron job.

### Cron Jobs (Proposal System)

A cron job is used to process and archive proposals.
*   **Script Path:** `src/scripts/cron/processProposals.ts`
*   **Functionality:**
    *   Processes active proposals whose voting period (`epochEnd`) has passed.
    *   Calculates final vote tallies and determines pass/fail status.
    *   Updates proposal status (e.g., to `closed_passed`, `closed_failed`).
    *   Triggers notifications to squad members about proposal outcomes.
    *   (Placeholder for token distribution on passed proposals).
    *   Archives proposals that have been closed for `CRON_PROPOSAL_ARCHIVE_DELAY_DAYS`.

**Running Cron Locally:**

To run this cron job locally (e.g., for testing), ensure `ts-node` is installed (`npm install -g ts-node` or add to devDependencies) and then execute:

```bash
node -r ts-node/register src/scripts/cron/processProposals.ts
```
Alternatively, if your `tsconfig.json` allows, you might compile it first and then run the JS file.

**Production Cron Setup:**

For production, set this script up with a cron scheduler. If using Vercel, you can define a cron job in `vercel.json` that calls an API route wrapper for this script:

```json
// In vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-proposals", // Create this API route to execute the script
      "schedule": "0 0 * * *" // Example: Every day at midnight UTC
    }
  ]
}
```
Create an API route (e.g., `src/pages/api/cron/process-proposals.ts`) that imports and calls the main function from `src/scripts/cron/processProposals.ts`.
Ensure any necessary environment variables are available to this API route.

## Environment Variables

Create a `.env.local` file in the root of the project and add the following variables:

```
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET= # Generate a strong secret: openssl rand -hex 32
X_CLIENT_ID= # Your X/Twitter App Client ID
X_CLIENT_SECRET= # Your X/Twitter App Client Secret

# Crossmint
NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE= # Your Crossmint Client-Side API Key (from Staging Console for dev)
# Ensure this key has 'users' and 'wallet API' scopes, JWT Auth enabled, and http://localhost:3000 whitelisted (or your dev port).

# MongoDB
MONGODB_URI= # Your MongoDB connection string (e.g., from Atlas)
MONGODB_DB_NAME=defoiaffiliate # Or your DB name

# For Agents (Conceptual - if deploying to Fleek or similar)
# CROSSMINT_SERVER_SIDE_API_KEY= # Crossmint Server-Side API key for agent actions
# ALCHEMY_API_KEY= # If using Crossmint EVM Smart Wallets that require Alchemy

# For Crossmint Verifiable Credentials (Future - if implementing real VCs)
# CROSSMINT_VC_SERVICE_KEY= # API key for Crossmint VC service
```

## Local Development

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    # or
    yarn install
    ```

2.  **Setup Database:**
    *   Ensure you have a MongoDB instance running and accessible.
    *   Update the `MONGODB_URI` and `MONGODB_DB_NAME` in your `.env.local`.
    *   Connect to your MongoDB instance using `mongosh` or a GUI tool.
    *   Create/verify the necessary unique indexes on the `users` collection:
        ```javascript
        // use your_database_name; // e.g., use defoiaffiliate;
        db.users.createIndex({ xUserId: 1 }, { unique: true, sparse: true }); // Ensure this matches your confirmed setup
        db.users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
        db.users.createIndex({ referralCode: 1 }, { unique: true, sparse: true }); // If using referrals
        ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    # or
    pnpm dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:3000` (or your configured port).

## Testing

### End-to-End Tests (Playwright)

1.  **Install Playwright & Browsers:**
    If you haven't already:
    ```bash
    npm install --save-dev @playwright/test
    npx playwright install
    ```

2.  **Run Tests:**
    Ensure the development server is running before executing E2E tests that target it.
    ```bash
    npx playwright test tests/e2e/onboarding.spec.ts
    ```
    To run in headed mode for debugging:
    ```bash
    npx playwright test tests/e2e/onboarding.spec.ts --headed
    ```
    To view the HTML report after a run:
    ```bash
    npx playwright show-report
    ```

**Note on E2E Test Linter/Type Errors:**
The test file `tests/e2e/onboarding.spec.ts` may show TypeScript linter errors in some editors related to:
*   `Cannot find module '@playwright/test'`: This typically indicates an issue with the TypeScript configuration (`tsconfig.json`) not recognizing Playwright types, or the editor's TS server needing a restart. Ensure `tsconfig.json` includes Playwright types (e.g., in `compilerOptions.types` or via `typeRoots`).
*   Type conflicts for `window.crossmintUiService` (and similar mocked global objects): These arise from differences between the specific types used in component code and the more generic `any` types used for mocking in the test file for expediency. A long-term fix involves creating shared type definition files (`.d.ts`) for these interfaces and importing them in both the application code and the test scripts. For sprint purposes, the tests aim for functional correctness and these specific type annotations in the test file can be refined later.

This project was developed with a focus on rapid iteration to achieve a walking skeleton within a 60-minute timeframe.