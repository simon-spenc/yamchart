#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('dashbook')
  .description('Git-native business intelligence dashboards')
  .version('0.1.0');

program.parse();
