import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service.js';
export declare class PermissionsGuard implements CanActivate {
    private readonly reflector;
    private readonly rbac;
    constructor(reflector: Reflector, rbac: RbacService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
