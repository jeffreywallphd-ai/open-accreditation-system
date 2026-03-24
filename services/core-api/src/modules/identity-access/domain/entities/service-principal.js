import { assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus, servicePrincipalType } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class ServicePrincipal {
  constructor(props) {
    assertRequired(props.id, 'ServicePrincipal.id');
    assertString(props.name, 'ServicePrincipal.name');
    assertOneOf(props.status, 'ServicePrincipal.status', Object.values(recordStatus));
    assertOneOf(props.principalType, 'ServicePrincipal.principalType', Object.values(servicePrincipalType));

    if (props.humanPersonId) {
      throw new ValidationError('ServicePrincipal must not be linked as a human approver surrogate');
    }

    this.id = props.id;
    this.name = props.name;
    this.description = props.description ?? null;
    this.principalType = props.principalType;
    this.clientId = props.clientId;
    this.credentialMetadata = props.credentialMetadata ?? {};
    this.status = props.status;
    this.humanPersonId = null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new ServicePrincipal({
      id: input.id ?? createId('sp'),
      name: input.name,
      description: input.description,
      principalType: input.principalType,
      clientId: input.clientId,
      credentialMetadata: input.credentialMetadata,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new ServicePrincipal({
      ...this,
      ...patch,
      humanPersonId: null,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
