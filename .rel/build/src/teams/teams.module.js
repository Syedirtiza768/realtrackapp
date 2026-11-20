"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const team_entity_js_1 = require("./entities/team.entity.js");
const team_member_entity_js_1 = require("./entities/team-member.entity.js");
const teams_controller_js_1 = require("./teams.controller.js");
const teams_service_js_1 = require("./teams.service.js");
let TeamsModule = class TeamsModule {
};
exports.TeamsModule = TeamsModule;
exports.TeamsModule = TeamsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([team_entity_js_1.Team, team_member_entity_js_1.TeamMember]), rbac_module_js_1.RbacModule],
        controllers: [teams_controller_js_1.TeamsController],
        providers: [teams_service_js_1.TeamsService],
        exports: [teams_service_js_1.TeamsService, typeorm_1.TypeOrmModule],
    })
], TeamsModule);
//# sourceMappingURL=teams.module.js.map