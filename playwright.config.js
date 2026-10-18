import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:50000,expect:{timeout:9000},
  use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}},
  webServer:{command:'npm start',url:'http://127.0.0.1:3000/health',reuseExistingServer:false,timeout:30000},
  reporter:'list',workers:1,
});
