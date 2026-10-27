import type { CreatePartyInput, UpdatePartyInput } from '../types/party.interface';
import { RequestError } from '../http/request-error';

const maximumNameLength = 100;
const maximumImageUrlLength = 255;
const maximumAbbreviationLength = 20;
const maximumLeaderLength = 100;
const maximumSeats = 150;
const colorPattern = /^#[0-9A-Fa-f]{6}$/u;
const allowedFields = new Set(['name', 'description', 'imageUrl', 'abbreviation', 'color', 'seats', 'leader', 'isActive']);

function validateName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || Array.from(value.trim()).length > maximumNameLength || value.includes('\0')) {
    throw new RequestError('name is verplicht en mag maximaal 100 tekens bevatten, zonder nultekens.');
  }

  return value.trim();
}

function validateDescription(value: unknown): string | null {
  if (value !== null && (typeof value !== 'string' || value.includes('\0'))) {
    throw new RequestError('description moet tekst zonder nultekens of null zijn.');
  }

  return value;
}

function validateIsActive(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new RequestError('isActive moet true of false zijn.');
  }

  return value;
}

function validateImageUrl(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0 || Array.from(value.trim()).length > maximumImageUrlLength || value.includes('\0')) {
    throw new RequestError('imageUrl moet een URL van maximaal 255 tekens of null zijn.');
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new RequestError('imageUrl moet een geldige HTTP- of HTTPS-URL zijn.');
    }
  }
  catch {
    throw new RequestError('imageUrl moet een geldige HTTP- of HTTPS-URL zijn.');
  }

  return value.trim();
}

function validateOptionalText(value: unknown, field: string, maximumLength: number): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || Array.from(value.trim()).length > maximumLength || value.includes('\0')) {
    throw new RequestError(`${field} moet tekst van maximaal ${String(maximumLength)} tekens of null zijn.`);
  }

  return value.trim() === '' ? null : value.trim();
}

function validateColor(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || !colorPattern.test(value)) {
    throw new RequestError('color moet een hexkleur zoals #00AA44 of null zijn.');
  }

  return value.toUpperCase();
}

function validateSeats(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maximumSeats) {
    throw new RequestError('seats moet een geheel getal van 0 tot en met 150 of null zijn.');
  }

  return value;
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

export function validateParty(body: unknown): CreatePartyInput {
  const fields = readBody(body, 'Stuur een JSON-object met de partijgegevens.');

  return {
    name: validateName('name' in fields ? fields['name'] : undefined),
    description: validateDescription('description' in fields ? fields['description'] : null),
    imageUrl: validateImageUrl('imageUrl' in fields ? fields['imageUrl'] : null),
    abbreviation: validateOptionalText('abbreviation' in fields ? fields['abbreviation'] : null, 'abbreviation', maximumAbbreviationLength),
    color: validateColor('color' in fields ? fields['color'] : null),
    seats: validateSeats('seats' in fields ? fields['seats'] : null),
    leader: validateOptionalText('leader' in fields ? fields['leader'] : null, 'leader', maximumLeaderLength),
    isActive: validateIsActive('isActive' in fields ? fields['isActive'] : true),
  };
}

export function validateUpdateParty(body: unknown): UpdatePartyInput {
  const fields = readBody(body, 'Stuur een JSON-object met de te wijzigen velden.');

  if (Object.keys(fields).length === 0) {
    throw new RequestError('Stuur ten minste één veld om te wijzigen.');
  }

  const result: { -readonly [Key in keyof UpdatePartyInput]: UpdatePartyInput[Key] } = {};

  if ('name' in fields) {
    result.name = validateName(fields['name']);
  }

  if ('description' in fields) {
    result.description = validateDescription(fields['description']);
  }

  if ('imageUrl' in fields) {
    result.imageUrl = validateImageUrl(fields['imageUrl']);
  }

  if ('abbreviation' in fields) {
    result.abbreviation = validateOptionalText(fields['abbreviation'], 'abbreviation', maximumAbbreviationLength);
  }

  if ('color' in fields) {
    result.color = validateColor(fields['color']);
  }

  if ('seats' in fields) {
    result.seats = validateSeats(fields['seats']);
  }

  if ('leader' in fields) {
    result.leader = validateOptionalText(fields['leader'], 'leader', maximumLeaderLength);
  }

  if ('isActive' in fields) {
    result.isActive = validateIsActive(fields['isActive']);
  }

  return result;
}
