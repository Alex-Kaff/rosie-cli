# Rosie CLI

Rosie is an AI-powered command-line interface tool built with TypeScript that uses OpenAI's API to help you interact with your computer through natural language.

## Features

- Chat with an AI assistant directly from your terminal
- Maintain conversation history across sessions
- Search files on your computer using natural language
- Run system commands through AI assistance
- Store and retrieve memories about user preferences
- Support for multiple conversations with conversation management
- Generate images using AI based on text prompts
- Analyze screen content through screenshots

## Installation

### Global Installation

```bash
npm install -g rosie-cli
```

### Installing required dependencies
Python:
- mss ``pip install mss``


This will make the `rosie` command available globally.

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI locally
npm start

# Development mode (without building)
npm run dev
```

## Usage

Once installed, you can use the CLI as follows:

```bash
# Start a conversation with Rosie
rosie Hello, what can you do for me?

# Enable thinking mode to see AI reasoning
rosie solve this math problem --thinking

# Search for files on your computer
rosie Find all PDF files in my Documents folder

# Run a system command
rosie What's my Node.js version?

# Create a new conversation
rosie Start a new conversation

# Switch to a specific conversation
rosie Switch to conversation [conversation_id]

# Generate an image
rosie Create an image of a sunset over mountains

# Analyze what's on your screen
rosie What's currently on my screen?
```

### Configuration

You can save your OpenAI API key so you don't need to provide it with each command:

```bash
# Save your OpenAI API key
rosie config --set-openai-key=your_api_key_here

# Set active conversation ID
rosie config --set-conversation-id=your_conversation_id

# Show current configuration (key will be masked for security)
rosie config --show
```

The configuration is stored in `~/.rosie-config.json` and conversation history in `~/.rosie-chat-history.json`.

### Global Options

- `--open_ai_key <key>`: Your OpenAI API key (overrides saved key)
- `--thinking`: Enable thinking mode to see AI reasoning process
- `--version`: Display version information
- `--help`: Display help information

## System Requirements

- Node.js v14 or later
- For file search functionality: [Everything](https://www.voidtools.com/) search tool installed (Windows only)
- Python for screenshot capabilities

## License

MIT 