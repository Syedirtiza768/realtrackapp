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
var AutomationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const automation_rule_entity_js_1 = require("./entities/automation-rule.entity.js");
let AutomationService = AutomationService_1 = class AutomationService {
    ruleRepo;
    eventEmitter;
    logger = new common_1.Logger(AutomationService_1.name);
    constructor(ruleRepo, eventEmitter) {
        this.ruleRepo = ruleRepo;
        this.eventEmitter = eventEmitter;
    }
    async findAll(query) {
        const qb = this.ruleRepo.createQueryBuilder('r');
        if (query?.triggerType) {
            qb.andWhere('r.triggerType = :triggerType', {
                triggerType: query.triggerType,
            });
        }
        if (query?.actionType) {
            qb.andWhere('r.actionType = :actionType', {
                actionType: query.actionType,
            });
        }
        if (query?.enabled === 'true' || query?.enabled === 'false') {
            qb.andWhere('r.enabled = :enabled', {
                enabled: query.enabled === 'true',
            });
        }
        if (query?.storeId) {
            qb.andWhere('(r.storeId = :storeId OR r.storeId IS NULL)', {
                storeId: query.storeId,
            });
        }
        if (query?.channel) {
            qb.andWhere('(r.channel = :channel OR r.channel IS NULL)', {
                channel: query.channel,
            });
        }
        return qb
            .orderBy('r.priority', 'DESC')
            .addOrderBy('r.createdAt', 'DESC')
            .getMany();
    }
    async findOne(id) {
        const rule = await this.ruleRepo.findOneBy({ id });
        if (!rule)
            throw new common_1.NotFoundException(`Automation rule ${id} not found`);
        return rule;
    }
    async create(dto) {
        const rule = this.ruleRepo.create(dto);
        const saved = await this.ruleRepo.save(rule);
        this.eventEmitter.emit('automation.rule_created', {
            ruleId: saved.id,
            name: saved.name,
        });
        this.logger.log(`Created automation rule: ${saved.name} (${saved.id})`);
        return saved;
    }
    async update(id, dto) {
        const rule = await this.findOne(id);
        Object.assign(rule, dto);
        const saved = await this.ruleRepo.save(rule);
        this.eventEmitter.emit('automation.rule_updated', {
            ruleId: saved.id,
            name: saved.name,
        });
        return saved;
    }
    async remove(id) {
        const rule = await this.findOne(id);
        await this.ruleRepo.remove(rule);
        this.eventEmitter.emit('automation.rule_deleted', {
            ruleId: id,
            name: rule.name,
        });
        this.logger.log(`Deleted automation rule: ${rule.name} (${id})`);
    }
    async toggle(id) {
        const rule = await this.findOne(id);
        rule.enabled = !rule.enabled;
        return this.ruleRepo.save(rule);
    }
    async execute(id) {
        const rule = await this.findOne(id);
        if (!rule.enabled) {
            return { executed: false, result: 'Rule is disabled' };
        }
        const conditionsMet = this.evaluateConditions(rule.conditions);
        if (!conditionsMet) {
            return { executed: false, result: 'Conditions not met' };
        }
        this.logger.log(`Executing rule "${rule.name}" (${rule.actionType})`);
        this.eventEmitter.emit(`automation.execute.${rule.actionType}`, {
            ruleId: rule.id,
            ruleName: rule.name,
            actionConfig: rule.actionConfig,
            triggerConfig: rule.triggerConfig,
        });
        rule.lastExecutedAt = new Date();
        rule.executionCount += 1;
        await this.ruleRepo.save(rule);
        return { executed: true, result: `Action ${rule.actionType} dispatched` };
    }
    async evaluateByTrigger(triggerType, context) {
        const qb = this.ruleRepo
            .createQueryBuilder('r')
            .where('r.triggerType = :triggerType', { triggerType })
            .andWhere('r.enabled = true')
            .orderBy('r.priority', 'DESC');
        if (context?.storeId) {
            qb.andWhere('(r.storeId = :storeId OR r.storeId IS NULL)', {
                storeId: context.storeId,
            });
        }
        if (context?.channel) {
            qb.andWhere('(r.channel = :channel OR r.channel IS NULL)', {
                channel: context.channel,
            });
        }
        const rules = await qb.getMany();
        let executed = 0;
        for (const rule of rules) {
            const result = await this.execute(rule.id);
            if (result.executed)
                executed++;
        }
        this.logger.log(`Evaluated ${rules.length} ${triggerType} rules, executed ${executed}`);
        return executed;
    }
    evaluateConditions(conditions) {
        if (!conditions || conditions.length === 0)
            return true;
        for (const condition of conditions) {
            const { field, operator, value } = condition;
            if (!field || !operator)
                continue;
            this.logger.debug(`Condition: ${field} ${operator} ${JSON.stringify(value)} — auto-pass (Phase 2 stub)`);
        }
        return true;
    }
};
exports.AutomationService = AutomationService;
exports.AutomationService = AutomationService = AutomationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(automation_rule_entity_js_1.AutomationRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], AutomationService);
//# sourceMappingURL=automation.service.js.map