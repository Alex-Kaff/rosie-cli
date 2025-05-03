export type Answer = {
  text: string;
  data?: any;
  ts: number;
}

export type Input = {
  text: string;
  ts: number;
  historyId?: string;
}

export type ChatEntry = {
  input: Input;
  answer: Answer;
}

// ChatGPT message types
export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  ts?: number;
}

// Chat history type for tracking conversations
export type ChatHistory = {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
} 

export type ActionType = "produce_text" | "new_conversation" | "search_pc" | "add_memory" | "run_cmd" | "set_conversation";

export type ActionParams<T extends ActionType> = T extends "produce_text" ? {
  inputMessage: Input;
  mode: "thinking" | "normal" | "fast"
} : T extends "new_conversation" ? {
  name?: string;
} : T extends "search_pc" ? {
  query: string;
} : T extends "add_memory" ? {
  text: string;
} : T extends "run_cmd" ? {
  cmd: string;
} : T extends "set_conversation" ? {
  id: string;
} : never;

export type Action = {
  type: ActionType;
  params: ActionParams<ActionType>;
  result?: any;
}

export type ContextUpdate = {
  answer: Answer;
  actions: Action[];
  actionRequests?: Action[];
  newParams?: any;
}

export type Memory = {
  items: {
    text: string;
    date: number;
  }[]
}