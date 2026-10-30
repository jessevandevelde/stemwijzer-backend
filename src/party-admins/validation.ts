import { RequestError } from '../http/request-error';
import type { CreatePartyAdminInput, UpdatePartyAdminInput } from '../types/party-admin.interface';

const maximumNameLength = 100;
const maximumEmailLength = 100;
const minimumPasswordLength = 8;
const maximumPasswordLength = 255;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const allowedFields = new Set(['name', 'email', 'password']);

function validateName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || Array.from(value.trim()).length > maximumNameLength || value.includes('\0')) {
    throw new RequestError('name is verplicht en mag maximaal 100 tekens bevatten, zonder nultekens.');
  }

  return value.trim();
}

function validateEmail(value: unknown): string {
  if (typeof value !== 'string' || Array.from(value.trim()).length > maximumEmailLength || !emailPattern.test(value.trim())) {
    throw new RequestError('email moet een geldig e-mailadres van maximaal 100 tekens zijn.');
  }

  return value.trim().toLowerCase();
}

function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || Array.from(value).length < minimumPasswordLength || Array.from(value).length > maximumPasswordLength || value.includes('\0')) {
    throw new RequestError('password moet 8 tot en met 255 tekens bevatten, zonder nultekens.');
  }

  return value;
}

function readBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError('Stuur een JSON-object met name, email en/of password.');
  }

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    throw new RequestError('Alleen name, email en password zijn toegestaan.');
  }

  return { ...body };
}

export function validateCreatePartyAdmin(body: unknown): CreatePartyAdminInput {
  const fields = readBody(body);

  return {
    name: validateName(fields['name']),
    email: validateEmail(fields['email']),
    password: validatePassword(fields['password']),
  };
}

export function validateUpdatePartyAdmin(body: unknown): UpdatePartyAdminInput {
  const fields = readBody(body);

  if (Object.keys(fields).length === 0) {
    throw new RequestError('Stuur ten minste één veld om te wijzigen.');
  }

  const result: { -readonly [Key in keyof UpdatePartyAdminInput]: UpdatePartyAdminInput[Key] } = {};

  if ('name' in fields) {
    result.name = validateName(fields['name']);
  }

  if ('email' in fields) {
    result.email = validateEmail(fields['email']);
  }

  if ('password' in fields) {
    result.password = validatePassword(fields['password']);
  }

  return result;
}
