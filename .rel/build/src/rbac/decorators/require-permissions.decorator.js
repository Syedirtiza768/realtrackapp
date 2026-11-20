"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAnyPermission = exports.RequirePermissions = exports.PERMISSIONS_MODE_KEY = exports.PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMISSIONS_KEY = 'permissions';
exports.PERMISSIONS_MODE_KEY = 'permissions_mode';
const RequirePermissions = (...permissions) => (0, common_1.applyDecorators)((0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions), (0, common_1.SetMetadata)(exports.PERMISSIONS_MODE_KEY, 'all'));
exports.RequirePermissions = RequirePermissions;
const RequireAnyPermission = (...permissions) => (0, common_1.applyDecorators)((0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions), (0, common_1.SetMetadata)(exports.PERMISSIONS_MODE_KEY, 'any'));
exports.RequireAnyPermission = RequireAnyPermission;
//# sourceMappingURL=require-permissions.decorator.js.map