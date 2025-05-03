# Installing Rosie CLI from npm

Once published, Rosie CLI can be installed directly from npm using the following command:

```bash
npm install -g rosie-cli
```

This will install the Rosie CLI globally on your system, making the `rosie` command available in your terminal.

## Requirements

- Node.js v14 or later
- An OpenAI API key
- For file search functionality: [Everything](https://www.voidtools.com/) search tool installed (Windows only)

## Configuration

After installation, you'll need to configure your OpenAI API key:

```bash
rosie config --set-openai-key=your_api_key_here
```

## Usage

You can then use Rosie as follows:

```bash
# Chat with Rosie
rosie Hello, what can you do for me?

# Search for files
rosie Find all PDF files in my Documents folder

# Run a system command
rosie What's my Node.js version?
```

For more information, see the full [README.md](https://github.com/yourusername/rosie-cli#readme). 