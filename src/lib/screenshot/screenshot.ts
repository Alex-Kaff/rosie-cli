import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';


export type Screenshot = { filename: string, buffer: Buffer };

export async function getScreenshots() : Promise<Screenshot[]> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [path.join(__dirname, '../../../assets/screenshot/screenshot.py')]);
    let outputData = '';

    // Capture stdout data from Python script
    python.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    python.on('close', async (code: number) => {
      if (code !== 0) return reject(new Error(`Python script exited with code ${code}`));

      try {
        // Parse the paths from Python's output and remove any carriage returns
        const filePaths = outputData.trim().split('\n').map(path => path.replace(/\r$/, ''));
        const screenshots: Screenshot[] = [];

        // Process each file path
        for (const filePath of filePaths) {
          if (!filePath.trim()) continue;
          
          try {
            const data = await fs.readFile(filePath);
            const filename = path.basename(filePath);
            screenshots.push({ filename, buffer: data });
          } catch (err) {
            console.error(`Error reading file ${filePath}:`, err);
          }
        }

        resolve(screenshots);
      } catch (err) {
        reject(err);
      }
    });

    python.on('error', reject);
  });
}
