const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  
  // Wait a moment for any animations/renders
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\b15c096d-13d8-45fe-9ca2-4ccccecfb09d\\user_screen.png' });
  
  console.log("Screenshot saved.");
  await browser.close();
})();
