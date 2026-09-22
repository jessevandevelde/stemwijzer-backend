import type { LoginCredentials } from '../types/auth.interface';
import { RequestError } from '../http/request-error';

const maximumEmailLength = 100;
const maximumPasswordLength = 255;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEmail(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || Array.from(value.trim()).length > maximumEmailLength || value.includes('\0')) {
    throw new RequestError('email is verplicht en mag maximaal 100 tekens bevatten, zonder nultekens.');
  }

  return value.trim();
}

function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || Array.from(value).length > maximumPasswordLength || value.includes('\0')) {
    throw new RequestError('password is verplicht en mag maximaal 255 tekens bevatten, zonder nultekens.');
  }

  return value;
}

export function validateLoginCredentials(body: unknown): LoginCredentials {
  if (!isRecord(body)) {
    throw new RequestError('Stuur een JSON-object met email en password.');
  }

  const allowedFields = new Set(['email', 'password']);

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    throw new RequestError('Alleen email en password zijn toegestaan.');
  }

  return {
    email: validateEmail(body['email']),
    password: validatePassword(body['password']),
  };
}
