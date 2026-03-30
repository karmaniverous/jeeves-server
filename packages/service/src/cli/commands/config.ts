/**
 * @packageDocumentation
 *
 * CLI commands: config validate, config show.
 */

import type { Command } from '@commander-js/extra-typings';

import { loadConfig } from '../../config/index.js';
import type { NormalizedScopes } from '../../config/types.js';

function formatScopes(scopes: NormalizedScopes | null): string {
  return scopes
    ? `scoped (allow: ${String(scopes.allow.length)}, deny: ${String(scopes.deny.length)})`
    : 'unscoped';
}

export function registerConfigCommand(cli: Command): void {
  const config = cli.command('config').description('Configuration management');

  config
    .command('validate')
    .description('Validate the configuration file')
    .option('-c, --config <path>', 'Path to configuration file')
    .action((options) => {
      try {
        const cfg = loadConfig(options.config);
        console.log('\u2713 Configuration valid');
        console.log(`  Port: ${String(cfg.port)}`);
        console.log(`  Host: ${cfg.host}`);
        console.log(`  Auth modes: ${cfg.authModes.join(', ')}`);
        console.log(`  Keys: ${String(cfg.resolvedKeys.length)}`);
        console.log(`  Insiders: ${String(cfg.resolvedInsiders.length)}`);
        console.log(
          `  Events: ${String(Object.keys(cfg.events).length)} schemas`,
        );
        if (cfg.watcherUrl) console.log(`  Watcher: ${cfg.watcherUrl}`);
        if (cfg.runnerUrl) console.log(`  Runner: ${cfg.runnerUrl}`);
        if (cfg.metaUrl) console.log(`  Meta: ${cfg.metaUrl}`);
      } catch (error) {
        console.error('\u2717 Configuration invalid');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  config
    .command('show')
    .description('Display resolved configuration with provenance')
    .option('-c, --config <path>', 'Path to configuration file')
    .action((options) => {
      try {
        const cfg = loadConfig(options.config);
        console.log(`Config file: ${cfg.configPath}`);
        console.log('');
        console.log('Server:');
        console.log(`  port: ${String(cfg.port)}`);
        console.log(`  host: ${cfg.host}`);
        console.log(`  chromePath: ${cfg.chromePath}`);
        if (cfg.roots) {
          console.log(`  roots: ${JSON.stringify(cfg.roots)}`);
        }
        console.log('');
        console.log('Auth:');
        console.log(`  modes: ${cfg.authModes.join(', ')}`);
        console.log(`  googleAuth: ${cfg.googleAuth ? 'configured' : 'none'}`);
        console.log(`  sessionSecret: ${cfg.sessionSecret ? '***' : 'none'}`);
        console.log('');
        console.log('Keys:');
        for (const key of cfg.resolvedKeys) {
          console.log(
            `  ${key.name}: ${key.seed.slice(0, 8)}... (${formatScopes(key.scopes)})`,
          );
        }
        console.log('');
        console.log('Insiders:');
        for (const insider of cfg.resolvedInsiders) {
          console.log(`  ${insider.email}: ${formatScopes(insider.scopes)}`);
        }
        console.log('');
        console.log('Integrations:');
        console.log(`  watcherUrl: ${cfg.watcherUrl ?? 'not configured'}`);
        console.log(`  runnerUrl: ${cfg.runnerUrl ?? 'not configured'}`);
        console.log(`  metaUrl: ${cfg.metaUrl ?? 'not configured'}`);
        console.log('');
        console.log('Events:');
        const eventNames = Object.keys(cfg.events);
        if (eventNames.length === 0) {
          console.log('  (none)');
        } else {
          for (const name of eventNames) {
            console.log(`  ${name}: ${cfg.events[name].cmd}`);
          }
        }
        console.log('');
        console.log('Diagrams:');
        console.log(
          `  mermaidCliPath: ${cfg.mermaidCliPath ?? 'not configured'}`,
        );
        console.log(
          `  plantuml.jarPath: ${cfg.plantuml.jarPath ?? 'not configured'}`,
        );
        console.log(`  plantuml.servers: ${cfg.plantuml.servers.join(', ')}`);
        console.log('');
        console.log('Paths:');
        console.log(`  stateFile: ${cfg.stateFile}`);
        console.log(`  eventsLog: ${cfg.eventsLog}`);
        console.log(
          `  diagramCachePath: ${cfg.diagramCachePath ?? '(default)'}`,
        );
      } catch (error) {
        console.error('Failed to load config');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
