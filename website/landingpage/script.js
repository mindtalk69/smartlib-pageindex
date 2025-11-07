// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Handle navigation link clicks
    const navLinks = document.querySelectorAll('.nav a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Handle CTA button and other anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') !== '#') {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetSection = document.getElementById(targetId);
                
                if (targetSection) {
                    const headerHeight = document.querySelector('.header').offsetHeight;
                    const targetPosition = targetSection.offsetTop - headerHeight - 20;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Header scroll effect
    let lastScrollTop = 0;
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        }
        
        lastScrollTop = scrollTop;
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.feature-item, .contact-item, .arch-step');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Mobile menu toggle (if needed in the future)
    function initializeMobileMenu() {
        const nav = document.querySelector('.nav');
        const headerContainer = document.querySelector('.header .container');
        
        if (window.innerWidth <= 768) {
            // Add mobile menu button if it doesn't exist
            if (!document.querySelector('.mobile-menu-toggle')) {
                const menuButton = document.createElement('button');
                menuButton.className = 'mobile-menu-toggle';
                menuButton.innerHTML = '☰';
                menuButton.setAttribute('aria-label', 'Toggle navigation menu');
                
                menuButton.addEventListener('click', function() {
                    nav.classList.toggle('mobile-open');
                    this.innerHTML = nav.classList.contains('mobile-open') ? '✕' : '☰';
                });
                
                headerContainer.appendChild(menuButton);
            }
        } else {
            // Remove mobile menu button if it exists
            const menuButton = document.querySelector('.mobile-menu-toggle');
            if (menuButton) {
                menuButton.remove();
            }
            nav.classList.remove('mobile-open');
        }
    }

    // Initialize mobile menu and handle resize
    initializeMobileMenu();
    window.addEventListener('resize', initializeMobileMenu);

    // Form validation for future contact forms
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Analytics tracking (placeholder)
    function trackEvent(eventName, properties = {}) {
        // Placeholder for analytics tracking
        console.log('Event tracked:', eventName, properties);
        
        // Example: Send to Google Analytics
        // if (typeof gtag !== 'undefined') {
        //     gtag('event', eventName, properties);
        // }
    }

    // Track CTA button clicks
    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.textContent.trim();
            trackEvent('cta_click', {
                button_text: buttonText,
                page_location: window.location.pathname
            });
        });
    });

    // Track section views
    const sectionObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                trackEvent('section_view', {
                    section_id: sectionId,
                    section_title: entry.target.querySelector('.section-title')?.textContent || sectionId
                });
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('section[id]').forEach(section => {
        sectionObserver.observe(section);
    });

    // Add loading state for external links
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.addEventListener('click', function() {
            // Add loading state
            const originalText = this.textContent;
            this.innerHTML = originalText + ' <span class="loading">...</span>';
            
            // Remove loading state after a short delay
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    });

    // Performance monitoring
    window.addEventListener('load', function() {
        const loadTime = performance.now();
        console.log('Page load time:', loadTime.toFixed(2), 'ms');
        
        // Track performance if analytics is available
        trackEvent('page_load', {
            load_time: Math.round(loadTime),
            page: window.location.pathname
        });
    });

    // Error handling
    window.addEventListener('error', function(e) {
        console.error('JavaScript error:', e.error);
        trackEvent('javascript_error', {
            error_message: e.message,
            error_filename: e.filename,
            error_lineno: e.lineno
        });
    });

    // Add CSS for mobile menu
    const mobileMenuCSS = `
        @media (max-width: 768px) {
            .mobile-menu-toggle {
                display: block;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #2563eb;
                padding: 0.5rem;
            }
            
            .nav {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                flex-direction: column;
                padding: 1rem;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                transform: translateY(-100%);
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .nav.mobile-open {
                transform: translateY(0);
                opacity: 1;
                visibility: visible;
            }
            
            .nav a {
                padding: 0.75rem 0;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .nav a:last-child {
                border-bottom: none;
            }
        }
        
        @media (min-width: 769px) {
            .mobile-menu-toggle {
                display: none !important;
            }
        }
        
        .loading {
            display: inline-block;
            animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `;

    // Add mobile menu styles to head
    const style = document.createElement('style');
    style.textContent = mobileMenuCSS;
    document.head.appendChild(style);
});

// Utility functions
const utils = {
    // Debounce function for performance optimization
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Check if element is in viewport
    isInViewport: function(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },

    // Get element's distance from top
    getOffsetTop: function(element) {
        let offsetTop = 0;
        while (element) {
            offsetTop += element.offsetTop;
            element = element.offsetParent;
        }
        return offsetTop;
    }
};

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
}
