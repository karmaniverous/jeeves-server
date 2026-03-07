#!/usr/bin/env node
/**
 * @packageDocumentation
 *
 * jeeves-server CLI entrypoint.
 * Commands: start, config validate, config show, service install/uninstall.
 */

import { Command } from '@commander-js/extra-typings';

import { packageVersion } from '../util/packageVersion.js';
import { registerConfigCommand } from './commands/config.js';
import { registerServiceCommand } from './commands/service.js';
import { registerStartCommand } from './commands/start.js';

const cli = new Command()
  .name('jeeves-server')
  .description('Self-hosted file browser, document server, and webhook gateway')
  .version(packageVersion);

registerStartCommand(cli);
registerConfigCommand(cli);
registerServiceCommand(cli);

cli.parse();
