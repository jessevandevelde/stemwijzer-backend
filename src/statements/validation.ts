import type { CreateStatementInput, StatementDetails, UpdateStatementInput } from '../types/statement.interface';
import { RequestError } from '../http/request-error';

const maximumTitleLength = 100;
const maximumThemeLength = 100;
const maximumParagraphLength = 5000;
const maximumArguments = 10;
const maximumArgumentLength = 500;

const detailFields = ['title', 'theme', 'explanation', 'consequence', 'argumentsFor', 'argumentsAgainst'] as const;
const allowedFields = new Set<string>(['text', 'isActive', ...detailFields]);

type MutableDetails = { -readonly [Key in keyof StatementDetails]?: StatementDetails[Key] };

function validateText(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new RequestError('text is verplicht en mag geen nultekens bevatten.');
  }

  return value.trim();
}

function validateIsActive(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new RequestError('isActive moet true of false zijn.');
  }

  return value;
}

// Lege tekst wordt null, zodat een veld leegmaken hetzelfde is als het weghalen.
function validateOptionalText(value: unknown, field: string, maximumLength: number): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || Array.from(value.trim()).length > maximumLength || value.includes('\0')) {
    throw new RequestError(`${field} moet tekst van maximaal ${String(maximumLength)} tekens of null zijn.`);
  }

  return value.trim() === '' ? null : value.trim();
}

function validateArguments(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > maximumArguments) {
    throw new RequestError(`${field} moet een lijst van maximaal ${String(maximumArguments)} argumenten zijn.`);
  }

  const items: readonly unknown[] = value;

  return items.map((item) => {
    if (typeof item !== 'string' || Array.from(item.trim()).length > maximumArgumentLength || item.includes('\0')) {
      throw new RequestError(`Elk argument in ${field} moet tekst van maximaal ${String(maximumArgumentLength)} tekens zijn.`);
    }

    return item.trim();
  }).filter(item => item !== '');
}

function validateDetails(fields: Record<string, unknown>): MutableDetails {
  const result: MutableDetails = {};

  if ('title' in fields) {
    result.title = validateOptionalText(fields['title'], 'title', maximumTitleLength);
  }

  if ('theme' in fields) {
    result.theme = validateOptionalText(fields['theme'], 'theme', maximumThemeLength);
  }

  if ('explanation' in fields) {
    result.explanation = validateOptionalText(fields['explanation'], 'explanation', maximumParagraphLength);
  }

  if ('consequence' in fields) {
    result.consequence = validateOptionalText(fields['consequence'], 'consequence', maximumParagraphLength);
  }

  if ('argumentsFor' in fields) {
    result.argumentsFor = validateArguments(fields['argumentsFor'], 'argumentsFor');
  }

  if ('argumentsAgainst' in fields) {
    result.argumentsAgainst = validateArguments(fields['argumentsAgainst'], 'argumentsAgainst');
  }

  return result;
}

function readBody(body: unknown, invalidMessage: string): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError(invalidMessage);
  }

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    throw new RequestError(`Alleen ${[...allowedFields].join(', ')} zijn toegestaan.`);
  }

  return { ...body };
}

export function validateCreateStatement(body: unknown): CreateStatementInput {
  const fields = readBody(body, 'Stuur een JSON-object met de stellinggegevens.');

  return {
    text: validateText('text' in fields ? fields['text'] : undefined),
    isActive: validateIsActive('isActive' in fields ? fields['isActive'] : true),
    ...validateDetails(fields),
  };
}

export function validateUpdateStatement(body: unknown): UpdateStatementInput {
  const fields = readBody(body, 'Stuur een JSON-object met de te wijzigen velden.');

  if (Object.keys(fields).length === 0) {
    throw new RequestError('Stuur ten minste één veld om te wijzigen.');
  }

  const result: { text?: string, isActive?: boolean } = {};

  if ('text' in fields) {
    result.text = validateText(fields['text']);
  }

  if ('isActive' in fields) {
    result.isActive = validateIsActive(fields['isActive']);
  }

  return { ...result, ...validateDetails(fields) };
}
