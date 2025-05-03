import { Answer, ContextUpdate, Input, Action, Memory } from "../types/";
import { Service } from "../types/service";
import { chatHistories, getChatGPTResponse, getOrCreateChatHistory } from "../lib/chatgpt";
import { ExecutionContext } from "../types/executionContext";
import { searchEverything } from "../lib/everything";
import { FileStore } from "../lib/filestore";
import { exec } from "child_process";
import * as readline from 'readline';
import path from "path";
import os from "os";
import { v4 as uuidv4 } from 'uuid';
import { ConfigManager } from "../configManager";
import fs from 'fs';

export const memoryStore = new FileStore<Memory>(path.join(os.homedir(), '.rosie-memory.json'), {items: []});

const configManager = new ConfigManager();

class MainProcessingService implements Service<never> {
    async processMessage(message: Input, context: ExecutionContext): Promise<ContextUpdate> {
        // Process the incoming message using ChatGPT directl
        const response = await getChatGPTResponse(message.text, context, {thinking: context.params.thinking});
        const answer: Answer = {
            text: response.text,
            ts: Date.now()
        };

        const action: Action = {
            type: "produce_text",
            params: {   
                inputMessage: message,
                mode: context.params.mode
            },
            result: response.text
        };

        let update: ContextUpdate = {answer, actions: [action], actionRequests: response.actionRequests};
        context.update(update);
        
        if (response.actionRequests && response.actionRequests.length > 0) {
            // Execute the actions
            for (const action of response.actionRequests) {
                if (action.type === "search_pc") {
                    // Search the pc for the query
                    const results = await searchEverything((action.params as { query: string }).query);

                    const searchAnalysis = await getChatGPTResponse(
                        `The results of the search are as follows:
                        ${JSON.stringify(results)}

                        Please analyze the results and provide a detailed analysis of the results based on the original query. You can not call any additional actions for this query.
                        `,
                        context,
                        {
                            role: "system",
                            dontUpdateHistory: true
                        }
                    )
                    action.result = searchAnalysis.text;
                } else if (action.type === "add_memory") {
                    // Add a memory about the user
                    const memory = await memoryStore.load();
                    memory.items.push({text: (action.params as {text: string}).text, date: Date.now()});
                    await memoryStore.save(memory);
                    action.result = true;
                } else if (action.type === "run_cmd") {
                    // Run a command on the pc
                    const cmd = (action.params as {cmd: string}).cmd;
                    try {
                        const { stdout, stderr } = await new Promise<{stdout: string, stderr: string}>(async (resolve, reject) => {
                            const confirmed = await showPopupDialog("Confirm Command", `Run command: ${cmd}`);
                            if (!confirmed) {
                                resolve({stdout: "", stderr: "User canceled the action"});
                                return;
                            }
                            exec(cmd, (error, stdout, stderr) => {
                                if (error) {
                                    resolve({stdout, stderr: error.message});
                                } else {
                                    resolve({ stdout, stderr });
                                }
                            });
                        });
                        action.result = stdout || stderr;
                    } catch (error) {
                        action.result = (error as Error).message;
                    }
                } else if (action.type === "new_conversation") {
                    // Create a new conversation
                    const newId = (action.params as {name?: string}).name || uuidv4();
                    await chatHistories.save({[newId]: {id: newId, messages: [], createdAt: Date.now(), updatedAt: Date.now()}});
                    configManager.setActiveConversationId(newId);
                    action.result = true;
                    const newUpdate: ContextUpdate = {answer: {text: "New conversation started", ts: Date.now()}, actions: [], actionRequests: []};
                    return newUpdate;
                } else if (action.type === "set_conversation") {
                    // Set the conversation
                    configManager.setActiveConversationId((action.params as {id: string}).id);
                    action.result = true;
                    const newUpdate: ContextUpdate = {answer: {text: "Conversation set to " + (action.params as {id: string}).id, ts: Date.now()}, actions: [], actionRequests: []};
                    return newUpdate;
                }
            }

            const newResponse = await getChatGPTResponse(`
                You have performed the following actions:
                ${JSON.stringify(response.actionRequests)}

                Based on the results, formulate a final answer to the user's query. You can not call any additional actions for this query.
                `, context, {thinking: false, role: "system"});

            const newUpdate: ContextUpdate = {answer: {text: newResponse.text, ts: Date.now()}, actions: [], actionRequests: []};
            return newUpdate;
        } else {
            return update;
        }
    } 
}

export default MainProcessingService;

export const getLastBashCommand = () => {
    try {
        const homedir = require('os').homedir();
        const bashHistoryPath = path.join(homedir, '.bash_history');
        if (fs.existsSync(bashHistoryPath)) {
            const history = fs.readFileSync(bashHistoryPath, 'utf-8');
            const commands = history.split('\n').filter(cmd => cmd.trim() !== '');
            if (commands.length > 0) {
                const lastCommand = commands[commands.length - 1];
                return lastCommand;
            } else {
                return null;
            }
        } else {
        }
    } catch (error) {
    }
};

export function showPopupDialog(title: string, message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<boolean>((resolve) => {
    console.log(`\n${title}`);
    console.log(`${message}`);
    
    rl.question('Confirm? (y/n): ', (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}