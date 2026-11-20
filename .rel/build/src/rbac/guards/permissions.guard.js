"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_js_1 = require("../../auth/decorators/public.decorator.js");
const require_permissions_decorator_js_1 = require("../decorators/require-permissions.decorator.js");
const rbac_service_js_1 = require("../rbac.service.js");
let PermissionsGuard = class PermissionsGuard {
    reflector;
    rbac;
    constructor(reflector, rbac) {
        this.reflector = reflector;
        this.rbac = rbac;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_js_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const required = this.reflector.getAllAndOverride(require_permissions_decorator_js_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!required?.length)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Authentication required');
        }
        const mode = this.reflector.getAllAndOverride(require_permissions_decorator_js_1.PERMISSIONS_MODE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? 'all';
        const granted = await this.rbac.getPermissionKeysForUser(user.id);
        const hasAccess = mode === 'any'
            ? required.some((p) => granted.has(p))
            : required.every((p) => granted.has(p));
        if (!hasAccess) {
            throw new common_1.ForbiddenException('Insufficient permissions');
        }
        return true;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        rbac_service_js_1.RbacService])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map