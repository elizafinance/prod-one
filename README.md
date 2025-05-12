# User Engagement & Rewards Platform

This platform is designed to foster user engagement through a points-based reward system, referral program, and social media interaction tracking. It integrates with X (formerly Twitter) for authentication and allows users to earn points for various activities.

![WebUI Preview](./template-image.jpg)

## Core Features

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