import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Interface for Everything search result items
 */
export interface EverythingResult {
  path: string;
  name: string;
  isFolder: boolean;
}

/**
 * Options for Everything search
 */
export interface EverythingOptions {
  regex?: boolean;
  matchCase?: boolean;
  matchPath?: boolean;
  matchWholeWord?: boolean;
  maxResults?: number;
  everythingPath?: string; // Custom path to Everything CLI
}

/**
 * Finds the Everything CLI executable
 * @returns Path to Everything CLI or null if not found
 */
export async function findEverythingCli(): Promise<string | null> {
  // Default paths to check for the Everything CLI
  const possiblePaths = [
    'C:\\Program Files\\Everything\\es.exe',
    'C:\\Program Files (x86)\\Everything\\es.exe',
  ];
  
  // Check if any of the default paths exist
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // Try to find it in PATH
  try {
    const { stdout } = await execAsync('where es.exe');
    const paths = stdout.trim().split('\n');
    if (paths.length > 0 && paths[0]) {
      return paths[0];
    }
  } catch (error) {
    // Not found in PATH, continue
  }
  
  return null;
}

/**
 * Queries VoidTools' Everything search engine via CLI
 * 
 * @param query - The search query string
 * @param options - Search options
 * @returns Promise resolving to an array of search results
 * @throws Error if Everything CLI is not found or search fails
 */
export async function searchEverything(
  query: string, 
  options: EverythingOptions = {}
): Promise<EverythingResult[]> {
  try {
    // Find the Everything CLI executable
    const everythingPath = options.everythingPath || await findEverythingCli();
    
    if (!everythingPath) {
      throw new Error('Everything CLI (es.exe) not found. Please install Everything search tool or provide a custom path.');
    }
    
    // Build command-line arguments
    const args = ['-csv']; // CSV output format
    
    // Add search options
    if (options.regex) args.push('-regex');
    if (options.matchCase) args.push('-case');
    if (options.matchPath) args.push('-path-match');
    if (options.matchWholeWord) args.push('-whole-word');
    
    args.push(`-max-results ${options.maxResults ?? 100}`);
    
    // Add the query (wrap in quotes to handle spaces)
    args.push(`"${query.replace(/"/g, '\\"')}"`);

    // Execute the command with increased maxBuffer size (50MB)
    const { stdout, stderr } = await execAsync(`"${everythingPath}" ${args.join(' ')}`, { maxBuffer: 50 * 1024 * 1024 });
    if (stderr) {
      console.error('Everything CLI error:', stderr);
    }
    
    // Parse CSV output
    const results: EverythingResult[] = [];
    if (stdout) {
      const lines = stdout.trim().split('\n');
      
      // Check if the first line is the header
      const hasHeader = lines[0] === 'Filename';
      const startLine = hasHeader ? 1 : 0;
      
      for (let i = startLine; i < lines.length; i++) {
        // The output format appears to be just the full path without CSV columns
        const path = lines[i].replace(/^"(.*)"$/, '$1'); // Remove surrounding quotes if present
        
        // Extract the filename from the path
        const name = path.split('\\').pop() || '';
        
        results.push({
          name: name,
          path: path,
          isFolder: name.endsWith('\\') || !name.includes('.')
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error executing Everything search:', error);
    throw new Error(`Everything search failed: ${(error as Error).message}`);
  }
}
