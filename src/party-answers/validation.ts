import { RequestError } from '../http/request-error';
import type { PartyAnswerInput } from '../types/party-answer.interface';

const maximumExplanationLength = 1000;

export function validatePartyAnswer(body: unknown): PartyAnswerInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError('Stuur een JSON-object met answer.');
  }

  if (Object.keys(body).some(key => key !== 'answer' && key !== 'explanation') || !('answer' in body)) {
    throw new RequestError('Stuur answer en eventueel explanation.');
  }

  const { answer } = body;

  if (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
    throw new RequestError('answer moet eens, neutraal, oneens of null zijn.');
  }

  if (!('explanation' in body)) {
    return { answer };
  }

  const { explanation } = body;

  if (explanation !== null && (typeof explanation !== 'string' || Array.from(explanation.trim()).length > maximumExplanationLength || explanation.includes('\0'))) {
    throw new RequestError('explanation moet tekst van maximaal 1000 tekens of null zijn.');
  }

  const trimmed = explanation === null || explanation.trim() === '' ? null : explanation.trim();

  if (answer === null && trimmed !== null) {
    throw new RequestError('Kies eerst een standpunt voordat je een uitleg geeft.');
  }

  return { answer, explanation: trimmed };
}
