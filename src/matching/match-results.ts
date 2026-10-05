import type { DatabaseSync } from 'node:sqlite';
import type { Answer } from '../types/answer.interface';
import type { MatchingResult, PartyMatch, SpectrumPosition } from '../types/matching.interface';

const percentageScale = 100;
const roundingScale = 100;
const positionRoundingScale = 1000;

const answerValue: Record<Answer, number> = { eens: 1, neutraal: 0, oneens: -1 };

interface WeightedAnswer {
  readonly answer: Answer
  readonly economicWeight: number
  readonly culturalWeight: number
}

function computePosition(weightedAnswers: readonly WeightedAnswer[]): SpectrumPosition {
  let economicSum = 0;
  let economicWeightSum = 0;
  let culturalSum = 0;
  let culturalWeightSum = 0;

  for (const { answer, economicWeight, culturalWeight } of weightedAnswers) {
    const value = answerValue[answer];

    economicSum += value * economicWeight;
    economicWeightSum += Math.abs(economicWeight);
    culturalSum += value * culturalWeight;
    culturalWeightSum += Math.abs(culturalWeight);
  }

  const round = (value: number): number => Math.round(value * positionRoundingScale) / positionRoundingScale;

  return {
    economicPosition: economicWeightSum === 0 ? 0 : round(economicSum / economicWeightSum),
    culturalPosition: culturalWeightSum === 0 ? 0 : round(culturalSum / culturalWeightSum),
  };
}

export function matchResults(database: DatabaseSync, answers: ReadonlyMap<number, Answer>): MatchingResult {
  const parties = database.prepare('SELECT id, name FROM parties WHERE is_active = 1 ORDER BY id').all();

  const partyAnswers = database.prepare(/* sql */ `
    SELECT current.statement_id AS statementId, current.answer, statements.economic_weight AS economicWeight, statements.cultural_weight AS culturalWeight
    FROM party_answers AS current
    JOIN statements ON statements.id = current.statement_id AND statements.is_active = 1
    WHERE current.party_id = ? AND current.id = (
      SELECT id FROM party_answers
      WHERE party_id = current.party_id AND statement_id = current.statement_id
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )
  `);

  const matches = parties.map((party): PartyMatch => {
    const partyId = party['id'];
    const partyName = party['name'];

    if (typeof partyId !== 'number' || typeof partyName !== 'string') {
      throw new Error('Ongeldige partijgegevens in de database.');
    }

    let matchedAnswers = 0;
    let comparedAnswers = 0;
    const weightedAnswers: WeightedAnswer[] = [];

    for (const row of partyAnswers.all(partyId)) {
      const { statementId, answer, economicWeight, culturalWeight } = row;

      if (typeof answer !== 'string' || (answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens')
        || typeof economicWeight !== 'number' || typeof culturalWeight !== 'number') {
        throw new Error('Ongeldige partijantwoorden in de database.');
      }

      weightedAnswers.push({ answer, economicWeight, culturalWeight });

      const userAnswer = typeof statementId === 'number' ? answers.get(statementId) : undefined;

      if (userAnswer !== undefined) {
        comparedAnswers += 1;

        if (userAnswer === answer) {
          matchedAnswers += 1;
        }
      }
    }

    return {
      partyId,
      partyName,
      matchPercentage: comparedAnswers === 0 ? null : Math.round(matchedAnswers / comparedAnswers * percentageScale * roundingScale) / roundingScale,
      matchedAnswers,
      comparedAnswers,
      missingAnswers: answers.size - comparedAnswers,
      ...computePosition(weightedAnswers),
    };
  });

  matches.sort((left, right) => (right.matchPercentage ?? -1) - (left.matchPercentage ?? -1)
    || right.comparedAnswers - left.comparedAnswers
    || left.partyId - right.partyId);

  const statementWeights = database.prepare('SELECT id, economic_weight AS economicWeight, cultural_weight AS culturalWeight FROM statements WHERE is_active = 1').all();

  const userWeightedAnswers: WeightedAnswer[] = [];

  for (const row of statementWeights) {
    const { id, economicWeight, culturalWeight } = row;
    const answer = typeof id === 'number' ? answers.get(id) : undefined;

    if (answer !== undefined && typeof economicWeight === 'number' && typeof culturalWeight === 'number') {
      userWeightedAnswers.push({ answer, economicWeight, culturalWeight });
    }
  }

  return { totalAnswers: answers.size, matches, userPosition: computePosition(userWeightedAnswers) };
}
