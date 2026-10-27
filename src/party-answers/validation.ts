import { RequestError } from '../http/request-error';
import type { Answer } from '../types/answer.interface';

export function validatePartyAnswer(body: unknown): Answer | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError('Stuur een JSON-object met answer.');
  }

  if (Object.keys(body).some(key => key !== 'answer') || !('answer' in body)) {
    throw new RequestError('Stuur alleen het veld answer.');
  }

  const { answer } = body;

  if (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
    throw new RequestError('answer moet eens, neutraal, oneens of null zijn.');
  }

  return answer;
}
