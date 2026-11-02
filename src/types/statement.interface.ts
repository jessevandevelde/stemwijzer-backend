import type { Answer } from './answer.interface';

// Toelichting voor kiezers; elk veld is optioneel zodat bestaande stellingen zonder toelichting blijven werken.
export interface StatementDetails {
  readonly title: string | null
  readonly theme: string | null
  readonly explanation: string | null
  readonly consequence: string | null
  readonly argumentsFor: readonly string[]
  readonly argumentsAgainst: readonly string[]
}

export interface PublicPartyAnswer {
  readonly partyId: number
  readonly partyName: string
  readonly abbreviation: string | null
  readonly color: string | null
  readonly answer: Answer | null
  readonly explanation: string | null
}

export interface StatementResult extends StatementDetails {
  readonly index: number
  readonly id: number
  readonly text: string
  readonly partyAnswers: readonly PublicPartyAnswer[]
}

export interface CreateStatementInput extends Partial<StatementDetails> {
  readonly text: string
  readonly isActive: boolean
}

export interface UpdateStatementInput extends Partial<StatementDetails> {
  readonly text?: string
  readonly isActive?: boolean
}

export interface StatementRecord extends StatementDetails {
  readonly id: number
  readonly text: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}
