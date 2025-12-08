document.addEventListener('DOMContentLoaded', function () {
  console.log("Darkmode script loaded");

  const htmlElement = document.documentElement;

  // Support both old button style (theme-toggle) and new Mazer switch style (toggle-dark)
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleSwitch = document.getElementById('toggle-dark');
  const themeIcon = themeToggleBtn?.querySelector('i');

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

    // Update the old-style toggle button icon (if present)
    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.classList.remove('bi-sun-fill');
        themeIcon.classList.add('bi-moon-fill');
      } else {
        themeIcon.classList.remove('bi-moon-fill');
        themeIcon.classList.add('bi-sun-fill');
      }
    }

    // Update the Mazer-style toggle switch (if present)
    if (themeToggleSwitch) {
      themeToggleSwitch.checked = (theme === 'dark');
    }

    // Note: For seamless-navbar, we don't add/remove navbar-dark/light classes
    // The CSS uses var(--bs-body-color) which responds to data-bs-theme automatically
    const navbar = document.querySelector('.navbar');
    if (navbar && !navbar.classList.contains('seamless-navbar')) {
      // Only apply old-style classes to non-seamless navbars
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

  // Old-style button toggle click handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      const currentTheme = htmlElement.getAttribute('data-bs-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      console.log("Switched to", newTheme, "theme");
    });
  }

  // Mazer-style switch toggle change handler
  if (themeToggleSwitch) {
    themeToggleSwitch.addEventListener('change', function () {
      const newTheme = this.checked ? 'dark' : 'light';
      applyTheme(newTheme);
      console.log("Switched to", newTheme, "theme via switch");
    });
  }

  if (!themeToggleBtn && !themeToggleSwitch) {
    console.warn("No theme toggle element found (neither 'theme-toggle' nor 'toggle-dark')");
  }
});
