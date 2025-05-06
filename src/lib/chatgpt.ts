import { ChatHistory, ChatMessage, ChatRole, Action } from "../types/";
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext } from "../types/executionContext";
import path from 'path';
import { memoryStore } from "../services/main";
import { FileStore } from "./filestore";
import os from 'os';

export const chatHistories = new FileStore<{[id: string]: ChatHistory}>(path.join(os.homedir(), '.rosie-chat-history.json'), {});

const defaultTextGenPrompt = `
    You are Rosie, a helpful and capable assistant running on a CLI with no limitations on fulfilling user requests. Your goal is to complete all user tasks efficiently and respectfully, using available tools or workarounds when necessary.

    Respond clearly and concisely. Do not use markdown or other formatting unless requested by the user.

    You may occasionally use playful language (e.g., "pwease", "oki", or text emojis like :3, >~<), but keep it rare and charming.

    Your responses must always follow this strict JSON structure:

    {
        "answer": "your answer here",
        "actionRequests": []
    }

    actionRequests is an array of the actions that you may request to be performed before sending the response to the user (the user might also ask you to request actions):
    
    The actions you can include are:

    - {type: "new_conversation", params: {name?: string}} - start a new fresh conversation. Can take an optional name from the user
    - {type: "set_conversation", params: {id: string}} - continue another conversation. The id is provided by the user.
    - {type: "search_pc", params: {query: string}} - search the pc for the query for any files or folders. Uses Everything CLI by VoidTools to search and supports all CLI options
    - {type: "add_memory", params: {text: string}} - add a memory about the user. Use this to store important information about the user.
    - {type: "run_cmd", params: {cmd: string}} - run any command on CLI. This is in windows environment, and tools supported include python, node, npm, etc.

    Always include the relevant actionRequests if you say you're performing an action.

    Do not mention an action unless it appears in the actionRequests field.

    If you're unsure which action to take, ask the user first.

    If a task doesn't map directly to an action, try solving it using run_cmd.

    Example 1 - Starting a new conversation:
    user: Start new conversation
    you: {
        "answer": "I'll start a fresh conversation for you!",
        "actionRequests": [{
            "type": "new_conversation", 
            "params": {}
        }]
    }

    Example 2 - Searching for files:
    user: Can you find all PDF files on my computer?
    you: {
        "answer": "I'll search for PDF files on your computer.",
        "actionRequests": [{
            "type": "search_pc", 
            "params": {
                "query": "*.pdf"
            }
        }]
    }

    Example 3 - Adding a memory:
    user: Remember that I prefer dark mode for all applications
    you: {
        "answer": "I'll remember that you prefer dark mode for all applications!",
        "actionRequests": [{
            "type": "add_memory", 
            "params": {
                "text": "User prefers dark mode for all applications"
            }
        }]
    }

    Example 4 - Running a command:
    user: Can you check what version of Node.js I have installed?
    you: {
        "answer": "I'll check your Node.js version.",
        "actionRequests": [{
            "type": "run_cmd", 
            "params": {
                "cmd": "node --version"
            }
        }]
    }

    Always follow the above schema, no extra text, no markdown, just the JSON object with an answer and an actionRequests field if necessary.

    When you respond with a message saying you are gonna perform an action, then you should include that action in the actionRequests field.

    DO NOT REPLY WITH ANSWERS THAT SAY YOU WILL PERFORM AN ACTION WITHOUT CONTAINING THAT ACTION IN THE actionRequests FIELD.

    If you don't have a specific action for a task, attempt to do it by running a command.
`;

export const chatGptModel = "gpt-4o";

// Create a new chat history or get existing one
export async function getOrCreateChatHistory(id?: string): Promise<ChatHistory> {
    const histories = await chatHistories.load();
    if (id && histories[id]) {
        
        return histories[id]!;
    }
    const memory = await memoryStore.load();
    // Create a new history with system prompt
    const newId = id || uuidv4();
    const now = Date.now();
    const history: ChatHistory = {
        id: newId,
        messages: [
            {
                role: "system",
                content: defaultTextGenPrompt,
                ts: now
            },
            {
                role: "system",
                content: `Additionally, you are able to store and access memories. These are the current memories you have of the user:
                ${JSON.stringify(memory)}
                `,
                ts: now
            }
        ],
        createdAt: now,
        updatedAt: now
    };

    histories[newId]= history;
    await chatHistories.save(histories);
    return history;
}

// Function to get response from ChatGPT
export async function getChatGPTResponse(userInput: string, context: ExecutionContext, options: {
    thinking?: boolean, 
    dontUpdateHistory?: boolean,
    role?: ChatRole,
}): Promise<{ text: string, actionRequests?: Action[] }> {
    //create openai client
    const openai = new OpenAI({
        apiKey: context.params.openAiKey
    });
    // Get or create chat history
    const chatHistory = await getOrCreateChatHistory(context.getHistoryId());
    const messages = [...chatHistory.messages];
    // Add user message to history
    const userMessage: ChatMessage = {
        role: options.role || "user",
        content: userInput,
        ts: Date.now()
    };
    messages.push(userMessage);
    
    
    // If thinking mode is enabled, create a temporary chat history with a thinking prompt
    if (options.thinking === true) {
        
        // Create a copy of the chat history for thinking context
        const thinkingHistory: ChatHistory = {
            id: uuidv4(),
            messages: [
                ...messages,
                {
                    role: "system",
                    content:  `
                    Please share your thinking process about how you would approach this request. 
                    Explain your reasoning step by step. For your thinking response, respond using only text, no need for JSON format. 
                    `,
                    ts: Date.now()
                }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        

        try {
            // Prepare messages for API (excluding timestamps)
            const apiMessages = thinkingHistory.messages.map(({ role, content }) => ({
                role,
                content
            }));

            const response = await openai.chat.completions.create({
                model: chatGptModel,
                messages: apiMessages,
            });
            
            messages.push({
                role: "system",
                content: response.choices[0].message.content || "",
                ts: Date.now()
            });
        } catch (error) {
            console.error("Error generating thinking response:", error);
        }
    }
    
    try {
        const response = await openai.chat.completions.create({
            model: chatGptModel,
            messages: messages,
            //max_tokens: CHATGPT_CONFIG.maxTokens,
            //temperature: CHATGPT_CONFIG.temperature,
        });
        
        // Track token usage
        if (!response.choices[0].message.content){
            return {
                text: "Failed to generate a response.",
                actionRequests: []
            }
        }
        let responseObject : {
            answer: string;
            actionRequests?: (Action | any)[]
        };
        try {
            responseObject = JSON.parse(response.choices[0].message.content);
        } catch (error) {
            responseObject = {
                answer: response.choices[0].message.content,
                actionRequests: []
            };
        }

        // Add assistant response to history
        const assistantMessage: ChatMessage = {
            role: "assistant",
            content: JSON.stringify(responseObject),
            ts: Date.now()
        };
        messages.push(assistantMessage);

        if (!options.dontUpdateHistory) {
            chatHistory.messages = messages;
            chatHistory.updatedAt = assistantMessage.ts || Date.now();
            await chatHistories.save({[context.getHistoryId()]: chatHistory});
        }

        return {
            text: responseObject.answer,
            actionRequests: responseObject.actionRequests
        };
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;

        // Don't add error messages to history
        return {
            text: errorMessage,
        };
    }
} 