describe('Login Tests', () => {
  let page;

  beforeEach(async () => {
    page = await createPage();
  });

  afterEach(async () => {
    await page.close();
  });

  test('should display login form', async () => {
    await page.goto('http://localhost:5000/login');
    
    // Check form elements exist
    const usernameInput = await page.$('#username');
    const passwordInput = await page.$('#password');
    const submitButton = await page.$('button[type="submit"]');
    
    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
  });

  test('should login successfully with valid credentials', async () => {
    await loginHelper(page, 'testuser', 'testpass');
    
    // Verify successful login
    const url = page.url();
    expect(url).toContain('/index');
  });

  test('should show error with invalid credentials', async () => {
    await page.goto('http://localhost:5000/login');
    await page.type('#username', 'wronguser');
    await page.type('#password', 'wrongpass');
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    // Check for error message
    const errorMessage = await page.$eval('.alert-danger', el => el.textContent);
    expect(errorMessage).toContain('Invalid username or password');
  });

  test('should validate empty form submission', async () => {
    await page.goto('http://localhost:5000/login');
    await page.click('button[type="submit"]');

    // Check HTML5 validation
    const username = await page.$eval('#username', el => el.validity.valid);
    const password = await page.$eval('#password', el => el.validity.valid);

    expect(username).toBeFalsy();
    expect(password).toBeFalsy();
  });

  test('should redirect to Azure login page', async () => {
    await page.goto('http://localhost:5000/login');
    
    const [newPage] = await Promise.all([
      new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
      page.click('a[href*="login_azure"]')
    ]);

    const url = newPage.url();
    expect(url).toContain('login.microsoftonline.com');
    await newPage.close();
  });

  test('should maintain login session', async () => {
    await loginHelper(page, 'testuser', 'testpass');
    
    // Navigate to another protected page
    await page.goto('http://localhost:5000/upload');
    const url = page.url();
    expect(url).toContain('/upload'); // Should not redirect to login
    
    // Check for logged-in user elements
    const logoutLink = await page.$('a[href*="logout"]');
    expect(logoutLink).toBeTruthy();
  });

  // Error case handling
  test('should handle server errors gracefully', async () => {
    // Simulate a server error by intercepting the login request
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/login') && request.method() === 'POST') {
        request.respond({
          status: 500,
          contentType: 'text/plain',
          body: 'Internal Server Error'
        });
      } else {
        request.continue();
      }
    });

    await page.goto('http://localhost:5000/login');
    await page.type('#username', 'testuser');
    await page.type('#password', 'testpass');
    await page.click('button[type="submit"]');

    // Check for error handling
    const errorElement = await page.$('.alert-danger');
    expect(errorElement).toBeTruthy();
  });
});
