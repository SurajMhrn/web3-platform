const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Expose a binding to allow page to log directly
  await page.exposeFunction('logFromPage', msg => console.log('PAGE LOG:', msg));
  
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', event => {
      window.logFromPage('UNCAUGHT ERROR: ' + event.message);
    });
    window.addEventListener('unhandledrejection', event => {
      window.logFromPage('UNHANDLED REJECTION: ' + event.reason);
    });
  });

  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to http://localhost:5173/admin ...");
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle0' });
  
  // We know it redirects to /login if not authenticated.
  // Wait for React to render something.
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.evaluate(() => document.body.innerHTML);
  console.log("BODY HTML length:", content.length);
  
  await browser.close();
})();
