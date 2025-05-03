import fs from 'fs';
import path from 'path';
import os from 'os';

interface RosieConfig {
  openai_key?: string;
  active_conversation_id?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: RosieConfig;

  constructor() {
    // Store config in user's home directory
    this.configPath = path.join(os.homedir(), '.rosie-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): RosieConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    
    return {};
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getOpenAIKey(): string | undefined {
    return this.config.openai_key;
  }

  setOpenAIKey(key: string): void {
    this.config.openai_key = key;
    this.saveConfig();
  }

  getActiveConversationId(): string | undefined {
    return this.config.active_conversation_id;
  }

  setActiveConversationId(id: string): void {
    this.config.active_conversation_id = id;
    this.saveConfig();
  }
} 