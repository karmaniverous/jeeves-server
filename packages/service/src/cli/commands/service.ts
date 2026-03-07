/**
 * @packageDocumentation
 *
 * CLI commands: service install, service uninstall, service start/stop/restart.
 */

import { Command } from '@commander-js/extra-typings';

const DEFAULT_SERVICE_NAME = 'JeevesServer';
const LINUX_SERVICE_NAME = 'jeeves-server';

export function registerServiceCommand(cli: Command): void {
  const service = cli
    .command('service')
    .description('System service management');

  service.addCommand(
    new Command('install')
      .description('Print install instructions for a system service')
      .option('-c, --config <path>', 'Path to configuration file')
      .option(
        '-n, --name <name>',
        'Service name',
        process.platform === 'win32'
          ? DEFAULT_SERVICE_NAME
          : LINUX_SERVICE_NAME,
      )
      .action((options) => {
        const name = options.name;
        const configArg = options.config ? ` --config "${options.config}"` : '';

        if (process.platform === 'win32') {
          console.log('# NSSM install commands:');
          console.log(
            `nssm install ${name} node "%CD%\\node_modules\\@karmaniverous\\jeeves-server\\dist\\src\\cli\\index.js" start${configArg}`,
          );
          console.log(`nssm set ${name} AppDirectory "%CD%"`);
          console.log(`nssm set ${name} AppStdout "%CD%\\logs\\service.log"`);
          console.log(
            `nssm set ${name} AppStderr "%CD%\\logs\\service-error.log"`,
          );
          console.log(`nssm set ${name} Start SERVICE_AUTO_START`);
          console.log(`nssm start ${name}`);
          return;
        }

        const unit = [
          '[Unit]',
          'Description=Jeeves Server',
          'After=network.target',
          '',
          '[Service]',
          'Type=simple',
          'WorkingDirectory=%h',
          `ExecStart=/usr/bin/env jeeves-server start${configArg}`,
          'Restart=on-failure',
          '',
          '[Install]',
          'WantedBy=default.target',
        ].join('\n');

        console.log('# systemd unit file');
        console.log(`# Save to: ~/.config/systemd/user/${name}.service`);
        console.log('');
        console.log(unit);
        console.log('');
        console.log('# Then run:');
        console.log('systemctl --user daemon-reload');
        console.log(`systemctl --user enable --now ${name}.service`);
      }),
  );

  service.addCommand(
    new Command('uninstall')
      .description('Print uninstall instructions for a system service')
      .option(
        '-n, --name <name>',
        'Service name',
        process.platform === 'win32'
          ? DEFAULT_SERVICE_NAME
          : LINUX_SERVICE_NAME,
      )
      .action((options) => {
        const name = options.name;

        if (process.platform === 'win32') {
          console.log('# NSSM uninstall commands:');
          console.log(`nssm stop ${name}`);
          console.log(`nssm remove ${name} confirm`);
          return;
        }

        console.log('# systemd uninstall:');
        console.log(`systemctl --user disable --now ${name}.service`);
        console.log(`rm ~/.config/systemd/user/${name}.service`);
        console.log('systemctl --user daemon-reload');
      }),
  );

  for (const action of ['start', 'stop', 'restart'] as const) {
    service.addCommand(
      new Command(action)
        .description(
          `${action.charAt(0).toUpperCase() + action.slice(1)} the system service`,
        )
        .option(
          '-n, --name <name>',
          'Service name',
          process.platform === 'win32'
            ? DEFAULT_SERVICE_NAME
            : LINUX_SERVICE_NAME,
        )
        .action((options) => {
          const name = options.name;

          if (process.platform === 'win32') {
            if (action === 'restart') {
              console.log(`nssm restart ${name}`);
            } else {
              console.log(`nssm ${action} ${name}`);
            }
            return;
          }

          console.log(`systemctl --user ${action} ${name}.service`);
        }),
    );
  }
}
