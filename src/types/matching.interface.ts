import type { Answer } from './answer.interface';

// important: de kiezer vindt deze stelling extra belangrijk; die telt dubbel mee in het percentage.
export interface UserAnswer {
  readonly answer: Answer
  readonly important: boolean
}

export interface PartyMatch {
  readonly partyId: number
  readonly partyName: string
  readonly matchPercentage: number | null
  readonly matchedAnswers: number
  readonly comparedAnswers: number
  readonly missingAnswers: number
  readonly economicPosition: number
  readonly culturalPosition: number
}

export interface SpectrumPosition {
  readonly economicPosition: number
  readonly culturalPosition: number
}

export interface MatchingResult {
  readonly totalAnswers: number
  readonly importantAnswers: number
  readonly matches: PartyMatch[]
  readonly userPosition: SpectrumPosition
}
