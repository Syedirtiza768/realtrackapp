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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const teams_service_js_1 = require("./teams.service.js");
const create_team_dto_js_1 = require("./dto/create-team.dto.js");
const update_team_dto_js_1 = require("./dto/update-team.dto.js");
const set_team_members_dto_js_1 = require("./dto/set-team-members.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
let TeamsController = class TeamsController {
    teamsService;
    rbac;
    constructor(teamsService, rbac) {
        this.teamsService = teamsService;
        this.rbac = rbac;
    }
    async list(user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'teams.manage');
        const teams = await this.teamsService.listTeams(viewAll, user.id);
        return { teams };
    }
    async getMembers(id) {
        const userIds = await this.teamsService.getMemberUserIds(id);
        return { userIds };
    }
    async create(dto) {
        const team = await this.teamsService.createTeam(dto);
        return { team };
    }
    async update(id, dto) {
        const team = await this.teamsService.updateTeam(id, dto);
        return { team };
    }
    async setMembers(id, dto) {
        const userIds = await this.teamsService.setMembers(id, dto);
        return { userIds };
    }
};
exports.TeamsController = TeamsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('teams.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'List teams (all for admins, member teams for others)',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/members'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('teams.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'List user IDs assigned to a team' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "getMembers", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('teams.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a team' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_team_dto_js_1.CreateTeamDto]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('teams.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a team' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_team_dto_js_1.UpdateTeamDto]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/members'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('teams.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Replace team member assignments' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_team_members_dto_js_1.SetTeamMembersDto]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "setMembers", null);
exports.TeamsController = TeamsController = __decorate([
    (0, swagger_1.ApiTags)('Teams'),
    (0, common_1.Controller)('teams'),
    __metadata("design:paramtypes", [teams_service_js_1.TeamsService,
        rbac_service_js_1.RbacService])
], TeamsController);
//# sourceMappingURL=teams.controller.js.map