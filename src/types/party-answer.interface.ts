import type { Answer } from './answer.interface';

export interface PartyAnswerRecord {
  readonly statementId: number
  readonly statementText: string
  readonly statementIsActive: boolean
  readonly answer: Answer | null
}
