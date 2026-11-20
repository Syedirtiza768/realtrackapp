"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowPasswordChange = exports.ALLOW_PASSWORD_CHANGE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChangeRequired';
const AllowPasswordChange = () => (0, common_1.SetMetadata)(exports.ALLOW_PASSWORD_CHANGE_KEY, true);
exports.AllowPasswordChange = AllowPasswordChange;
//# sourceMappingURL=allow-password-change.decorator.js.map