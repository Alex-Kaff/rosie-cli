import { Answer, ContextUpdate } from ".";
import { v4 as uuidv4 } from 'uuid';

export class ExecutionContext {
    private answerHistory: ContextUpdate[] = [];
    private currentAnswer: Answer | null = null;
    private historyId: string;
    public params: any = {};
  
    constructor(historyId?: string) {
      this.historyId = historyId || uuidv4();
    }
  
    getHistoryId() {
      return this.historyId;
    }
    
    setHistoryId(id: string) {
      this.historyId = id;
    }
  
    update(update: ContextUpdate) {
      this.currentAnswer = update.answer;
      this.answerHistory.push({
        answer: update.answer,
        actions: update.actions
      });
    }
  
    getAnswerHistory() {
      return this.answerHistory;
    }
  
    getAnswer() {
      return this.currentAnswer;
    }
} 