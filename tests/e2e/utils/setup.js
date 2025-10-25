const puppeteer = require('puppeteer');

// Global setup for all tests
beforeAll(async () => {
  global.browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1280,
      height: 720
    }
  });
});

// Global teardown
afterAll(async () => {
  await global.browser.close();
});

// Helper functions
global.createPage = async () => {
  const page = await global.browser.newPage();
  
  // Add error handling
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });
  
  page.on('console', message => {
    if (message.type() === 'error') {
      console.error('Console error:', message.text());
    }
  });

  return page;
};

// Common test utilities
global.loginHelper = async (page, username, password) => {
  await page.goto('http://localhost:5000/login');
  await page.type('#username', username);
  await page.type('#password', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation()
  ]);
};

// Screenshot utility for failures
global.captureFailure = async (page, testName) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `./test-failures/${testName}-${timestamp}.png`,
    fullPage: true
  });
};
