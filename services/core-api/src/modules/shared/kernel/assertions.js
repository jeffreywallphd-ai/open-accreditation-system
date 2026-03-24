import { ValidationError } from './errors.js';

export function assertRequired(value, field) {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${field} is required`);
  }
}

export function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
}

export function assertDateOrder(startDate, endDate, startField = 'effectiveStartDate', endField = 'effectiveEndDate') {
  if (startDate && endDate && new Date(startDate).getTime() > new Date(endDate).getTime()) {
    throw new ValidationError(`${startField} must be before or equal to ${endField}`);
  }
}

export function assertOneOf(value, field, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowedValues.join(', ')}`);
  }
}
