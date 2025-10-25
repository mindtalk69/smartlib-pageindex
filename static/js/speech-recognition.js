// Speech Recognition Manager
const SpeechManager = (function() {
    let recognition;
    let isListening = false;
    let retryCount = 0;
    const maxRetries = 3;

    function setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported');
            return false;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        setupEventHandlers();
        return true;
    }

    function setupEventHandlers() {
        recognition.onstart = handleStart;
        recognition.onend = handleEnd;
        recognition.onresult = handleResult;
        recognition.onerror = handleError;
    }

    function handleStart() {
        console.log('Speech recognition started');
        isListening = true;
        updateUI(true);
    }

    function handleEnd() {
        console.log('Speech recognition ended');
        isListening = false;
        updateUI(false);
        retryCount = 0;
    }

    function handleResult(event) {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        // Update query input with transcript
        const queryInput = document.querySelector('textarea[name="query"]');
        if (queryInput) {
            queryInput.value = transcript;
        }
    }

    function handleError(event) {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'network') {
            retryRecognition();
        } else {
            isListening = false;
            updateUI(false);
            showErrorMessage(event.error);
        }
    }

    function retryRecognition() {
        if (retryCount < maxRetries && isListening) {
            retryCount++;
            if (typeof window.showToast === 'function') {
                window.showToast(`Reconnecting to speech service... (attempt ${retryCount}/${maxRetries})`, 'warning');
            }
            setTimeout(() => {
                try {
                    recognition?.start();
                } catch (e) {
                    console.error('Retry failed:', e);
                }
            }, 1000);
        } else {
            isListening = false;
            updateUI(false);
            if (typeof window.showToast === 'function') {
                window.showToast('Speech recognition service unavailable. Please check your internet connection.', 'error');
            }
        }
    }

    function updateUI(isActive) {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            if (isActive) {
                micBtn.classList.add('btn-danger');
                micBtn.classList.remove('btn-outline-secondary');
            } else {
                micBtn.classList.remove('btn-danger');
                micBtn.classList.add('btn-outline-secondary');
            }
            micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
        }
    }

    function showErrorMessage(errorType) {
        if (typeof window.showToast === 'function') {
            const errorMessages = {
                'network': 'Network error occurred. Check your internet connection.',
                'no-speech': 'No speech detected. Please try again.',
                'audio-capture': 'No microphone detected. Please check your microphone settings.',
                'not-allowed': 'Microphone access denied. Please allow microphone access.',
                'aborted': 'Speech recognition was aborted',
                'service-not-allowed': 'Speech recognition service not allowed'
            };
            const errorMessage = errorMessages[errorType] || `Speech recognition error: ${errorType}`;
            window.showToast(errorMessage, 'error');
        }
    }

    function startListening() {
        if (!recognition && !setupRecognition()) {
            if (typeof window.showToast === 'function') {
                window.showToast('Speech recognition is not supported in your browser', 'error');
            }
            return;
        }

        try {
            recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            recognition.stop();
        }
    }

    function init() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            // Handle mouse events
            micBtn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent text selection
                startListening();
            });

            micBtn.addEventListener('mouseup', () => {
                stopListening();
            });

            micBtn.addEventListener('mouseleave', () => {
                if (isListening) {
                    stopListening();
                }
            });

            // Handle touch events
            micBtn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent scrolling
                startListening();
            });

            micBtn.addEventListener('touchend', () => {
                stopListening();
            });

            micBtn.addEventListener('touchcancel', () => {
                if (isListening) {
                    stopListening();
                }
            });
        }
    }

    return {
        init: init,
        isSupported: () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    };
})();

// Initialize speech recognition when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    SpeechManager.init();
});
