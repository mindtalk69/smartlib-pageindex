document.addEventListener('DOMContentLoaded', function() {
  console.log("Darkmode script loaded");
  
  const htmlElement = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle?.querySelector('i');
  
  // Check for saved theme preference or use user's system preference
  const storedTheme = localStorage.getItem('theme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const initialTheme = storedTheme || systemTheme;
  
  // Apply the theme on page load
  applyTheme(initialTheme);
  
  // Function to apply theme
  function applyTheme(theme) {
    // Set data-bs-theme attribute for Bootstrap 5
    htmlElement.setAttribute('data-bs-theme', theme);

    // Update the theme toggle button icon
    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.classList.remove('bi-sun-fill');
        themeIcon.classList.add('bi-moon-fill');
      } else {
        themeIcon.classList.remove('bi-moon-fill');
        themeIcon.classList.add('bi-sun-fill');
      }
    }

    // Toggle navbar classes for light/dark mode
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      navbar.classList.remove('navbar-dark', 'navbar-light', 'bg-dark', 'bg-light');
      if (theme === 'dark') {
        navbar.classList.add('navbar-dark', 'bg-dark');
      } else {
        navbar.classList.add('navbar-light', 'bg-light');
      }
    }

    // For backwards compatibility with any older CSS
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    // Store the preference
    localStorage.setItem('theme', theme);
    console.log("Applied theme:", theme);
  }
  
  // Theme toggle button click handler
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const currentTheme = htmlElement.getAttribute('data-bs-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      applyTheme(newTheme);
      console.log("Switched to", newTheme, "theme");
    });
  } else {
    console.error("Theme toggle button not found");
  }
});
