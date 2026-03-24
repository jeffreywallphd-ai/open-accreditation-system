export class DomainError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = 'DomainError';
    this.details = details;
  }
}

export class NotFoundError extends DomainError {
  constructor(entityName, id) {
    super(`${entityName} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DomainError {
  constructor(message, details = undefined) {
    super(message, details);
    this.name = 'ValidationError';
  }
}
