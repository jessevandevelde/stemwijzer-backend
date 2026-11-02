import type { Answer } from './answer.interface';

export interface PartyAnswerRecord {
  readonly statementId: number
  readonly statementText: string
  readonly statementIsActive: boolean
  readonly answer: Answer | null
  readonly explanation: string | null
}

// explanation undefined betekent: de bestaande uitleg laten staan.
export interface PartyAnswerInput {
  readonly answer: Answer | null
  readonly explanation?: string | null
}
