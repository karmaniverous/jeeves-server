// puppeteer-core 23.x ships broken ESM declarations (*.d.ts.map without
// matching *.d.ts). Re-export the CJS declarations so TypeScript can
// resolve the module under `moduleResolution: "Bundler"`.
declare module 'puppeteer-core' {
  export * from 'puppeteer-core/lib/cjs/puppeteer/index.js';

  import type { Browser } from 'puppeteer-core/lib/cjs/puppeteer/api/Browser.js';
  import type { LaunchOptions } from 'puppeteer-core/lib/cjs/puppeteer/node/LaunchOptions.js';

  interface PuppeteerNode {
    launch(options?: LaunchOptions): Promise<Browser>;
  }

  const puppeteer: PuppeteerNode;
  export default puppeteer;
}
