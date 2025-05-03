#!/usr/bin/env node

// Silence the punycode deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
        return;
    }
    console.warn(warning.name, warning.message);
});

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from './configManager';
import MainProcessingService from './services/main';
import { ExecutionContext } from './types/executionContext';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';

// Generate a session ID for this CLI instance
// This will remain the same for the duration of the CLI window


// Read package.json to get the version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Initialize config manager
const configManager = new ConfigManager();

const program = new Command();

program
    .name('rosie')
    .description('A CLI tool for Rosie')
    .version(packageJson.version)
    .option('--open_ai_key <key>', 'Your OpenAI API key');

// Add config command
program
    .command('config')
    .description('Configure Rosie CLI settings')
    .option('--set-openai-key <key>', 'Set your OpenAI API key')
    .option('--set-conversation-id <id>', 'Set active conversation ID')
    .option('--show', 'Show current configuration')
    .action((options) => {
        if (options.setOpenaiKey) {
            configManager.setOpenAIKey(options.setOpenaiKey);
            console.log('✅ OpenAI API key saved successfully');
        } else if (options.setConversationId) {
            configManager.setActiveConversationId(options.setConversationId);
            console.log('✅ Active conversation ID set to:', options.setConversationId);
        } else if (options.show) {
            const savedKey = configManager.getOpenAIKey();
            const activeConversationId = configManager.getActiveConversationId();

            if (savedKey) {
                // Show just the first and last few characters for security
                const maskedKey = savedKey.substring(0, 4) + '...' + savedKey.substring(savedKey.length - 4);
                console.log('OpenAI API key:', maskedKey);
            } else {
                console.log('No OpenAI API key configured');
            }

            if (activeConversationId) {
                console.log('Active conversation ID:', activeConversationId);
            } else {
                console.log('No active conversation ID configured (using new conversation for each session)');
            }
        } else {
            console.log('Use --set-openai-key to save your OpenAI API key, --set-conversation-id to set active conversation ID, or --show to view current config');
        }
    });


// Add default command that processes any text input
program
    .arguments('[text...]')
    .description('Process any text input')
    .option('--thinking', 'Enable thinking mode.')
    .action(async (text, options) => {
        const globalOptions = program.opts();
        const openAIKey = globalOptions.open_ai_key || configManager.getOpenAIKey();

        if (!text || text.length === 0) {
            // No text provided, show help
            program.outputHelp();
            return;
        }

        const userInput = text.join(' ');

        if (openAIKey) {
            const mainService = new MainProcessingService();

            // Use the active conversation ID from config if available, otherwise use the session ID
            let conversationId = configManager.getActiveConversationId();
            if (!conversationId) {
                conversationId = uuidv4();
                configManager.setActiveConversationId(conversationId);
            }
            // Create context with the conversation ID
            const context = new ExecutionContext(conversationId);
            context.params.openAiKey = openAIKey;
            context.params.thinking = options.thinking || false;

            const result = await mainService.processMessage(
                {
                    text: userInput,
                    ts: Date.now(),
                    historyId: conversationId
                },
                context
            );
            console.log("> " + result.answer.text);
        } else {
            console.log('No OpenAI API key provided. Use --open_ai_key or run "rosie config --set-openai-key=YOUR_KEY"');
        }
    });

// Parse command line arguments
program.parse(process.argv);