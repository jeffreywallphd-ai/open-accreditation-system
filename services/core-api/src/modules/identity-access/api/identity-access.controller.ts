import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { IAM_SERVICE } from '../identity-access.module.js';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';

const createUserSchema = z.object({
  id: z.string().optional(),
  personId: z.string().min(1),
  institutionId: z.string().min(1),
  externalSubjectId: z.string().optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  lastLoginAt: z.string().optional(),
  accessAttributes: z.record(z.any()).optional(),
});

const updateUserSchema = z
  .object({
    externalSubjectId: z.string().optional(),
    email: z.string().email().optional(),
    status: z.string().optional(),
    lastLoginAt: z.string().optional(),
    accessAttributes: z.record(z.any()).optional(),
  })
  .partial();

const createRoleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  scopeType: z.string().optional(),
  status: z.string().optional(),
});

const updateRoleSchema = createRoleSchema.partial();

const createPermissionSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const updatePermissionSchema = createPermissionSchema.partial().omit({ key: true });

const grantPermissionSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
  reason: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeType: z.string().min(1),
  institutionId: z.string().optional(),
  organizationUnitId: z.string().optional(),
  committeeId: z.string().optional(),
  accreditationCycleId: z.string().optional(),
  reviewTeamId: z.string().optional(),
  reason: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const revokeAssignmentSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
  effectiveEndDate: z.string().min(1),
});

const listUsersQuerySchema = z.object({
  id: z.string().optional(),
  personId: z.string().optional(),
  institutionId: z.string().optional(),
  status: z.string().optional(),
  email: z.string().optional(),
});

const listRolesQuerySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  code: z.string().optional(),
  scopeType: z.string().optional(),
  status: z.string().optional(),
});

const listPermissionsQuerySchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
});

const createServicePrincipalSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  principalType: z.string().min(1),
  clientId: z.string().min(1),
  credentialMetadata: z.record(z.any()).optional(),
  status: z.string().optional(),
});

const updateServicePrincipalSchema = createServicePrincipalSchema.partial().omit({ principalType: true, clientId: true });

const listServicePrincipalsQuerySchema = z.object({
  id: z.string().optional(),
  principalType: z.string().optional(),
  status: z.string().optional(),
  clientId: z.string().optional(),
  name: z.string().optional(),
});

const effectivePermissionsQuerySchema = z.object({
  at: z.string().optional(),
});

@Controller('identity-access')
export class IdentityAccessController {
  constructor(@Inject(IAM_SERVICE) private readonly service) {}

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body(new ZodValidationPipe(createUserSchema)) body) {
    return { data: await this.service.createUser(body) };
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body(new ZodValidationPipe(updateUserSchema)) body) {
    return { data: await this.service.updateUser(id, body) };
  }

  @Get('users')
  async listUsers(@Query(new ZodValidationPipe(listUsersQuerySchema)) query) {
    return { data: await this.service.listUsers(query) };
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  async createRole(@Body(new ZodValidationPipe(createRoleSchema)) body) {
    return { data: await this.service.createRole(body) };
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body(new ZodValidationPipe(updateRoleSchema)) body) {
    return { data: await this.service.updateRole(id, body) };
  }

  @Get('roles')
  async listRoles(@Query(new ZodValidationPipe(listRolesQuerySchema)) query) {
    return { data: await this.service.listRoles(query) };
  }

  @Post('permissions')
  @HttpCode(HttpStatus.CREATED)
  async createPermission(@Body(new ZodValidationPipe(createPermissionSchema)) body) {
    return { data: await this.service.createPermission(body) };
  }

  @Patch('permissions/:id')
  async updatePermission(@Param('id') id: string, @Body(new ZodValidationPipe(updatePermissionSchema)) body) {
    return { data: await this.service.updatePermission(id, body) };
  }

  @Get('permissions')
  async listPermissions(@Query(new ZodValidationPipe(listPermissionsQuerySchema)) query) {
    return { data: await this.service.listPermissions(query) };
  }

  @Post('role-permission-grants')
  async grantPermissionToRole(@Body(new ZodValidationPipe(grantPermissionSchema)) body) {
    return { data: await this.service.grantPermissionToRole(body) };
  }

  @Post('user-role-assignments')
  async assignRoleToUser(@Body(new ZodValidationPipe(assignRoleSchema)) body) {
    return { data: await this.service.assignRoleToUser(body) };
  }

  @Post('user-role-assignments/:assignmentId/revoke')
  async revokeRoleAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body(new ZodValidationPipe(revokeAssignmentSchema)) body,
  ) {
    return {
      data: await this.service.revokeRoleAssignment(body.userId, assignmentId, body.reason, body.effectiveEndDate),
    };
  }

  @Get('users/:userId/effective-permissions')
  async getEffectivePermissions(
    @Param('userId') userId: string,
    @Query(new ZodValidationPipe(effectivePermissionsQuerySchema)) query,
  ) {
    return { data: await this.service.getEffectivePermissionsForUser(userId, query.at) };
  }

  @Post('service-principals')
  @HttpCode(HttpStatus.CREATED)
  async createServicePrincipal(@Body(new ZodValidationPipe(createServicePrincipalSchema)) body) {
    return { data: await this.service.registerServicePrincipal(body) };
  }

  @Patch('service-principals/:id')
  async updateServicePrincipal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateServicePrincipalSchema)) body,
  ) {
    return { data: await this.service.updateServicePrincipal(id, body) };
  }

  @Get('service-principals')
  async listServicePrincipals(@Query(new ZodValidationPipe(listServicePrincipalsQuerySchema)) query) {
    return { data: await this.service.listServicePrincipals(query) };
  }
}
