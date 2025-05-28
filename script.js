document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');

    if (loginButton) {
        const crossmintClient = window.crossmintUiService.init({
            // Use environment variables for configuration.
            // In a Next.js environment, these will be replaced at build time.
            clientId: process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE,
            environment: "staging",
            // The server-side key can optionally be used for privileged calls.
            // While the client SDK typically only needs the client-side key, we expose
            // it here in case future functionality requires it. NEVER commit real keys.
            serverSideKey: process.env.NEXT_PUBLIC_CROSSMINT_SERVER_SIDE,
            uiConfig: {
                // colors: {
                //     primary: "#007bff",
                // }
            },
            walletConfig: {
                chain: "polygon",
            },
        });

        loginButton.addEventListener('click', () => {
            console.log('Login button clicked, attempting to show Crossmint modal.');
            if (crossmintClient && typeof crossmintClient.showLoginModal === 'function') {
                crossmintClient.showLoginModal();
            } else {
                console.error('Crossmint client or showLoginModal function is not available.');
            }
        });
        console.log('Crossmint SDK initialized and event listener attached.');
    } else {
        console.error('Login button not found.');
    }
}); 