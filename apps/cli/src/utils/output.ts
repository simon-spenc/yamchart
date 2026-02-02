import pc from 'picocolors';
import ora, { type Ora } from 'ora';

export const symbols = {
  success: pc.green('✓'),
  error: pc.red('✗'),
  warning: pc.yellow('⚠'),
  info: pc.blue('ℹ'),
  arrow: pc.dim('→'),
};

export function success(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

export function error(message: string): void {
  console.log(`${symbols.error} ${message}`);
}

export function warning(message: string): void {
  console.log(`${symbols.warning} ${message}`);
}

export function info(message: string): void {
  console.log(`${symbols.info} ${message}`);
}

export function detail(message: string): void {
  console.log(`  ${symbols.arrow} ${message}`);
}

export function newline(): void {
  console.log();
}

export function header(title: string): void {
  console.log(pc.bold(title));
  newline();
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function box(lines: string[]): void {
  const maxLength = Math.max(...lines.map((l) => l.length));
  const width = maxLength + 4;
  const border = '─'.repeat(width);

  console.log(`  ┌${border}┐`);
  for (const line of lines) {
    const padding = ' '.repeat(maxLength - line.length);
    console.log(`  │  ${line}${padding}  │`);
  }
  console.log(`  └${border}┘`);
}
