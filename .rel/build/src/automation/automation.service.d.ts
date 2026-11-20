import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationRule } from './entities/automation-rule.entity.js';
import type { CreateAutomationRuleDto, UpdateAutomationRuleDto, AutomationRuleQueryDto } from './dto/automation-rule.dto.js';
export declare class AutomationService {
    private readonly ruleRepo;
    private readonly eventEmitter;
    private readonly logger;
    constructor(ruleRepo: Repository<AutomationRule>, eventEmitter: EventEmitter2);
    findAll(query?: AutomationRuleQueryDto): Promise<AutomationRule[]>;
    findOne(id: string): Promise<AutomationRule>;
    create(dto: CreateAutomationRuleDto): Promise<AutomationRule>;
    update(id: string, dto: UpdateAutomationRuleDto): Promise<AutomationRule>;
    remove(id: string): Promise<void>;
    toggle(id: string): Promise<AutomationRule>;
    execute(id: string): Promise<{
        executed: boolean;
        result?: string;
    }>;
    evaluateByTrigger(triggerType: string, context?: Record<string, unknown> & {
        storeId?: string;
        channel?: string;
    }): Promise<number>;
    private evaluateConditions;
}
