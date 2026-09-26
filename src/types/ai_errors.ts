export class AIContextError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AIContextError';
  }
}
