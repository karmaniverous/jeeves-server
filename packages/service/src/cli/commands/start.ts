/**
 * @packageDocumentation
 *
 * CLI command: start — launches the Fastify server.
 */

import type { Command } from '@commander-js/extra-typings';

export function registerStartCommand(cli: Command): void {
  cli
    .command('start')
    .description('Start the jeeves-server')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
      try {
        // Dynamic import to avoid loading server code at CLI parse time
        const { initConfig } = await import('../../config/index.js');
        await initConfig(options.config);

        // Import server after config is initialized
        await import('../../server.js');
      } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
      }
    });
}
