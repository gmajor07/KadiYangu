import {defineConfig} from "@playwright/test";
const port=process.env.SCANNER_TEST_PORT || "3207";
export default defineConfig({
 testDir:"./tests/scanner-browser",workers:1,fullyParallel:false,timeout:120000,
 expect:{timeout:15000},
 use:{baseURL:`http://localhost:${port}`,headless:true,trace:"retain-on-failure",screenshot:"only-on-failure",launchOptions:{args:["--use-fake-device-for-media-stream","--disable-gpu"],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}},
 webServer:{command:`PORT=${port} HOSTNAME=127.0.0.1 node .next/standalone/server.js`,url:`http://localhost:${port}/api/health`,reuseExistingServer:false,timeout:60000},
});
