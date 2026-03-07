#!/usr/bin/env node
/**
 * @packageDocumentation
 *
 * jeeves-server CLI entrypoint.
 * Commands: start, config validate, config show, service install/uninstall.
 */

import { createRequire } from 'node:module';

import { Command } from '@commander-js/extra-typings';

import { registerConfigCommand } from './commands/config.js';
import { registerServiceCommand } from './commands/service.js';
import { registerStartCommand } from './commands/start.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json') as { version: string };

const cli = new Command()
  .name('jeeves-server')
  .description('Self-hosted file browser, document server, and webhook gateway')
  .version(version);

registerStartCommand(cli);
registerConfigCommand(cli);
registerServiceCommand(cli);

cli.parse();
