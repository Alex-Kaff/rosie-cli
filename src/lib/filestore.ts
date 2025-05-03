import fs from 'fs';
import path from 'path';

/**
 * Generic file storage class that handles saving and loading data as JSON
 * @template T The type of data to be stored
 */
export class FileStore<T> {
  private filePath: string;

  /**
   * Creates a new FileStore instance
   * @param filePath Path where the data will be stored
   */
  constructor(filePath: string, defaultData: T) {
    this.filePath = filePath;
    
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      // Create an empty file with default structure
      // Determine the default structure based on the generic type T
      // Write the default structure to the file
      fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2), 'utf8');
    }
  }

  /**
   * Saves data to the file as JSON
   * @param data The data to save
   * @returns Promise that resolves when the data is saved
   */
  async save(data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFile(this.filePath, jsonData, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Loads data from the file
   * @returns Promise that resolves with the loaded data, or null if the file doesn't exist
   */
  async load(): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.filePath)) {
        throw new Error(`File ${this.filePath} does not exist`);
      }

      fs.readFile(this.filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          try {
            const parsedData = JSON.parse(data) as T;
            resolve(parsedData);
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });
  }
}
