import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@repo/db';
import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';

import { auth } from '@repo/auth';
import {
  PERMISSIONS_KEY,
  PermissionRequirement,
} from '../decorators/permissions.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Entities } from '../../types/permissions.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headers = fromNodeHeaders(request.headers);

    // 1. Authenticate user session
    const sessionDetails = await auth.api.getSession({ headers });
    if (!sessionDetails || !sessionDetails.session) {
      throw new UnauthorizedException('Authentication required');
    }

    // Attach user to request for downstream use (controllers, decorators)
    const req = request as Request & { user?: unknown; session?: unknown };
    req.user = sessionDetails.user;
    req.session = sessionDetails.session;

    // 2. Enforce role-based protection when declared
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length) {
      const userRole = sessionDetails.user.role as Role | undefined;

      if (!userRole || !requiredRoles.includes(userRole)) {
        throw new ForbiddenException(
          "You don't have the required role to do this action",
        );
      }
    }

    // 3. Extract required permissions from decorator
    const requirement = this.reflector.getAllAndOverride<
      PermissionRequirement<Entities>
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // If no specific permissions are required, basic authentication is enough
    if (!requirement) {
      return true;
    }

    const { entity, permissions } = requirement;
    const permissionArray = Array.isArray(permissions)
      ? permissions
      : [permissions];

    try {
      // 4. Validate permissions against Better Auth
      const { error, success } = await auth.api.userHasPermission({
        headers,
        body: {
          permissions: {
            [entity as string]: permissionArray,
          },
        },
      });

      if (error) {
        this.logger.error(
          `hasPermission returned error: ${JSON.stringify(error)}`,
        );
        throw new InternalServerErrorException(
          'An error occurred while checking permissions',
        );
      }

      if (success === true) {
        return true;
      }

      if (success === false) {
        throw new ForbiddenException(
          "You don't have permission to do this action",
        );
      }

      this.logger.error(
        `Unexpected response from hasPermission (success=${String(success)})`,
      );
      throw new InternalServerErrorException(
        'An error occurred while checking permissions',
      );
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Unexpected exception: ${error instanceof Error ? error.stack || error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'An error occurred while checking permissions',
      );
    }
  }
}
