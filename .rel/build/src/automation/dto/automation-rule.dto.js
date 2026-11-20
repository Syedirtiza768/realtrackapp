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
exports.AutomationRuleQueryDto = exports.UpdateAutomationRuleDto = exports.CreateAutomationRuleDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateAutomationRuleDto {
    name;
    description;
    triggerType;
    triggerConfig;
    actionType;
    actionConfig;
    conditions;
    enabled;
    priority;
    storeId;
    channel;
}
exports.CreateAutomationRuleDto = CreateAutomationRuleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Low stock price increase' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['schedule', 'event', 'condition'] }),
    (0, class_validator_1.IsEnum)(['schedule', 'event', 'condition']),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "triggerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateAutomationRuleDto.prototype, "triggerConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [
            'update_price',
            'sync_inventory',
            'publish',
            'end_listing',
            'notify',
            'apply_template',
        ],
    }),
    (0, class_validator_1.IsEnum)([
        'update_price',
        'sync_inventory',
        'publish',
        'end_listing',
        'notify',
        'apply_template',
    ]),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "actionType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateAutomationRuleDto.prototype, "actionConfig", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'array' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateAutomationRuleDto.prototype, "conditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateAutomationRuleDto.prototype, "enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateAutomationRuleDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Scope rule to a specific store (null = all stores)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Scope rule to a specific channel (null = all channels)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "channel", void 0);
class UpdateAutomationRuleDto {
    name;
    description;
    triggerType;
    triggerConfig;
    actionType;
    actionConfig;
    conditions;
    enabled;
    priority;
    storeId;
    channel;
}
exports.UpdateAutomationRuleDto = UpdateAutomationRuleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['schedule', 'event', 'condition']),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "triggerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateAutomationRuleDto.prototype, "triggerConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)([
        'update_price',
        'sync_inventory',
        'publish',
        'end_listing',
        'notify',
        'apply_template',
    ]),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "actionType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateAutomationRuleDto.prototype, "actionConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateAutomationRuleDto.prototype, "conditions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAutomationRuleDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateAutomationRuleDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "channel", void 0);
class AutomationRuleQueryDto {
    triggerType;
    actionType;
    enabled;
    storeId;
    channel;
}
exports.AutomationRuleQueryDto = AutomationRuleQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutomationRuleQueryDto.prototype, "triggerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutomationRuleQueryDto.prototype, "actionType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutomationRuleQueryDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutomationRuleQueryDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutomationRuleQueryDto.prototype, "channel", void 0);
//# sourceMappingURL=automation-rule.dto.js.map