export function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Use relative path for maximum compatibility across different deployments/subdirectories
            const swPath = './sw.js';

            navigator.serviceWorker.register(swPath)
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
}
