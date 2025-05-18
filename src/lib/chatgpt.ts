import { ChatHistory, ChatMessage, ChatRole, Action } from "../types/";
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext } from "../types/executionContext";
import path from 'path';
import { memoryStore } from "../services/main";
import { FileStore } from "./filestore";
import os from 'os';
import fs from 'fs/promises';
import sharp from 'sharp';

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

    - {type: "new_conversation", params: {name?: string}} - start a new fresh conversation. Can take an optional name from the user. By starting a new conversation, the current chat history with you and the user will be deleted, and a new one will start.
    - {type: "search_pc", params: {query: string}} - search the pc for the query for any files or folders. Uses Everything CLI by VoidTools to search and supports all CLI options. Use this if the user asks you to find files or other content on their PC.
    - {type: "add_memory", params: {text: string}} - add a memory about the user. Use this to store important information about the user. After a conversation is over (i.e by the user saying "thank you" or "bye"), you can use this to remember a quick summary of the conversation if it provides any interesting insights on the user that you believe you should remember.
    - {type: "run_cmd", params: {cmd: string}} - run any command on CLI. This is in windows environment, and tools supported include python, node, npm, etc. Use this if the user asks you to do something that requires running a command on the PC. If the user asks you to do something that you cannot perform, use a command instead.
    - {type: "gen_image", params: {prompt: string, inputImages?: string[]}} - generate an image based on the prompt. You can also pass paths to images that you want to use in your input if the user asks for it. Use this whenever the user asks you to generate any kind of image.
    - {type: "analyze_screen", params: {prompt: string, screenIndex: number}} - analyze the screen at the given index. Use this whenever the user asks you to analyze the screen. The user may have multiple monitors, so the screen index must be provided. If it is not provided by the user, ask for it and call this action after they answer.

    Always include the relevant actionRequests if you say you're performing an action.

    The actions will be performed in the order in which they appear inside the array.

    In your answer field, do not mention an action unless it appears in the actionRequests field.

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

    Example 5 - Generating an image:
    user: Can you create an image that combines logo.png and background.jpg from this folder?
    you: {
        "answer": "I'll generate a new image combining logo.png and background.jpg for you.",
        "actionRequests": [{
            "type": "gen_image", 
            "params": {
                "prompt": "Combine the logo and background image seamlessly",
                "inputImages": ["logo.png", "background.jpg"]
            }
        }]
    }

    Example 6 - Analyzing user's screen:
    user: What is in this image on screen 0?
    you: {
        "answer": "I'll analyze the screen for you.",
        "actionRequests": [{
            "type": "analyze_screen", 
            "params": {
                "prompt": "What is in this image?",
                "screenIndex": 0
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

export async function generateImage(prompt: string, inputImages: string[], context: ExecutionContext): Promise<string> {
    const client = new OpenAI({
        apiKey: context.params.openAiKey
    });
    // Prepare input images if provided
    const images :File[]= [];
    
    if (inputImages && inputImages.length > 0) {
        for (const imagePath of inputImages) {
            try {
                // Read the image file
                const imageBuffer = await fs.readFile(imagePath);
                
                // Convert to PNG for DALL-E 2 which only supports PNG format
                const pngBuffer = await sharp(imageBuffer).toFormat('png').toBuffer();
                
                // Create a file-like object that satisfies the Uploadable type
                const file = new File([pngBuffer], path.basename(imagePath).replace(/\.[^/.]+$/, '.png'), {
                    type: "image/png" // Always use PNG mime type
                });
                images.push(file);
            } catch (error) {
                console.error(`Error loading/converting image ${imagePath}:`, error);
                throw new Error(`Failed to load/convert image: ${imagePath}`);
            }
        }
    }
    try {
        // Choose between generate and edit based on whether input images are provided
        const response = images.length > 0 
            ? await client.images.edit({
                model: "dall-e-2",
                image: images[0],
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
              })
            : await client.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
                quality: "standard",
              });

        // Extract the base64 image data from the response
        if (response.data && response.data.length > 0 && response.data[0].b64_json) {
            return `${response.data[0].b64_json}`;
        } else {
            throw new Error("No image data received from OpenAI");
        }
    } catch (error) {
        console.error("Error generating image with OpenAI:", error);
        throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function analyzeImage(imageBuffer: Buffer, prompt: string, context: ExecutionContext): Promise<string> {
    const client = new OpenAI({
        apiKey: context.params.openAiKey
    });
    
    try {
        // Process image with sharp to optimize size if needed
        // This is important for large images as there are API size limits
        const processedImageBuffer = await sharp(imageBuffer)
            .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true }) // Resize if too large
            .toFormat('jpeg', { quality: 85 }) // Use JPEG for better compression
            .toBuffer();
            
        // Convert to base64
        const base64Image = processedImageBuffer.toString('base64');
        // Create the API request with the image
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user", 
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 5000
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
            return response.choices[0].message.content;
        } else {
            throw new Error("No analysis data received from OpenAI");
        }
    } catch (error) {
        console.error("Error analyzing image with OpenAI:", error);
        throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

