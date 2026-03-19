#!/usr/bin/env node
/**
 * Post-install script — shows getting started guide after npm install.
 */
import { printWelcome } from '../utils/welcome.js';

printWelcome();
