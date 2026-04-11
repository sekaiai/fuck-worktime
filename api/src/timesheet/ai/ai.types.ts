export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface AiChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: AiChatChoice[];
}
