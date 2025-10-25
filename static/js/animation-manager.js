// animation-manager.js
// Loads and manages background animations based on settings and page context.

// --- Animation System References ---
// Assumes particles.js, flow.js, constellation.js are loaded before this script
// and expose their classes globally (e.g., window.ParticleSystem).

const ActualParticleSystem = window.ParticleSystem;
const ActualFlowSystem = window.FlowSystem;
const ActualConstellationSystem = window.ConstellationSystem;


document.addEventListener('DOMContentLoaded', () => {
    console.log("Animation Manager Initializing...");

    // --- Configuration ---
    // Use the actual system classes loaded from their respective files
    const animationSystems = {
        'particles': ActualParticleSystem,
        'flow': ActualFlowSystem,
        'constellation': ActualConstellationSystem
    };
    const animationKeys = Object.keys(animationSystems);

    // --- State ---
    let currentAnimationInstance = null;
    let currentCanvas = null;

    // --- Helper Functions ---
    function isUserLoggedIn() {
        // Simple check: presence of logout button usually indicates logged in.
        // Adjust selector if needed based on your actual base.html structure.
        return document.querySelector('a[href="/logout"]') !== null;
    }

    function getCurrentPageType() {
        const pathname = window.location.pathname;
        if (pathname.startsWith('/admin')) return 'admin';
        if (pathname === '/login') return 'login';
        if (pathname === '/register') return 'register';
        // Use startsWith for flexibility (e.g., handles /upload/ or /upload?params)
        if (pathname.startsWith('/upload')) return 'upload'; 
        if (pathname === '/') {
            // Differentiate between welcome and chat interface on root path
            return isUserLoggedIn() ? 'chat' : 'welcome';
        }
        return 'other'; // For any other pages
    }

    function shouldRunAnimation(pageType) {
        // Pages where animation *should* run
        const allowedPages = ['welcome', 'login', 'register', 'upload'];
        return allowedPages.includes(pageType);
    }

    // --- Core Animation Logic ---
    function runAnimation() {
        console.log("runAnimation called");

        // 1. Stop/Clear Previous Animation
        console.log("[AM Cleanup] Checking for existing animation instance...");
        if (currentAnimationInstance) {
            console.log("[AM Cleanup] Found existing instance. Attempting to stop...");
            try {
                currentAnimationInstance.stop();
                console.log("[AM Cleanup] Successfully called stop() on instance.");
            } catch (e) {
                console.error("[AM Cleanup] Error stopping previous animation instance:", e);
            } finally {
                 // Always nullify after attempting stop
                currentAnimationInstance = null;
                console.log("[AM Cleanup] currentAnimationInstance set to null.");
            }
        } else {
            console.log("[AM Cleanup] No existing animation instance found.");
        }

        console.log("[AM Cleanup] Checking for existing canvas...");
        if (currentCanvas) {
            console.log("[AM Cleanup] Found existing canvas. Attempting to remove...");
            try {
                currentCanvas.remove();
                console.log("[AM Cleanup] Successfully removed canvas.");
            } catch (e) {
                console.error("[AM Cleanup] Error removing previous canvas:", e);
            } finally {
                // Always nullify after attempting remove
                currentCanvas = null;
                console.log("[AM Cleanup] currentCanvas set to null.");
            }
        } else {
             console.log("[AM Cleanup] No existing canvas found.");
        }

        // 2. Check Page Context
        const pageType = getCurrentPageType();
        console.log(`Current page type: ${pageType}`);
        if (!shouldRunAnimation(pageType)) {
            console.log("Animation not required for this page type. Exiting runAnimation.");
            return;
        }

        // 3. Check Enabled Status
        const isEnabledRaw = localStorage.getItem('backgroundAnimationEnabled');
        const isEnabled = isEnabledRaw ?? 'true'; // Default to true if null/undefined
        console.log(`[AM Debug] Raw enabled value from localStorage: ${isEnabledRaw}`);
        console.log(`[AM Debug] Effective enabled status (defaulting to true if null): ${isEnabled}`);

        if (isEnabled !== 'true') {
            console.log("[AM Debug] Animation is explicitly disabled ('false' or other). Stopping here.");
            // Ensure cleanup happened before this check
            if (currentAnimationInstance || currentCanvas) {
                 console.warn("[AM Debug] Cleanup might not have fully completed before disable check.");
            }
            return; // Exit if not enabled
        }
        console.log("[AM Debug] Animation is enabled ('true'). Proceeding to select animation.");

        // 4. Select Animation
        let selectedKey = 'particles'; // Default
        if (pageType === 'welcome') {
            // Random selection for welcome page
            selectedKey = animationKeys[Math.floor(Math.random() * animationKeys.length)];
            console.log(`Welcome page: Randomly selected animation: ${selectedKey}`);
        } else {
            // Use stored preference for logged-in allowed pages
            selectedKey = localStorage.getItem('backgroundAnimationSelected') ?? 'particles';
            console.log(`Logged-in page (${pageType}): Selected animation from localStorage: ${selectedKey}`);
        }

        // 5. Instantiate and Initialize
        const AnimationSystem = animationSystems[selectedKey];
        if (!AnimationSystem) {
            console.error(`Selected animation system "${selectedKey}" not found!`);
            return;
        }

        try {
            console.log(`Creating canvas for ${selectedKey}...`);
            currentCanvas = document.createElement('canvas');
            currentCanvas.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 0; 
            `;
            // Insert canvas behind everything else
            document.body.insertBefore(currentCanvas, document.body.firstChild);

            console.log(`Instantiating ${selectedKey}...`);
            currentAnimationInstance = new AnimationSystem(currentCanvas);
            // Add log to confirm instance assignment
            console.log(`[AM State] Assigned currentAnimationInstance:`, currentAnimationInstance); 

            console.log(`Initializing ${selectedKey}...`);
            currentAnimationInstance.init();
            // Add log to confirm canvas assignment persists
            console.log(`[AM State] Assigned currentCanvas:`, currentCanvas); 
            console.log(`${selectedKey} animation started successfully.`);

        } catch (error) {
            console.error(`Failed to start animation "${selectedKey}":`, error);
            if (currentCanvas) currentCanvas.remove(); // Clean up canvas if init fails
            currentCanvas = null;
            currentAnimationInstance = null;
        }
    }

    // --- Event Listener for Settings Changes ---
    window.addEventListener('animationSettingsChanged', () => {
        console.log("animationSettingsChanged event received.");
        runAnimation(); // Re-run the logic when settings change
    });

    // --- Initial Call ---
    runAnimation();

    console.log("Animation Manager Initialized Successfully.");
});
