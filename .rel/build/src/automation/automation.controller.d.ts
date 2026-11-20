import { AutomationService } from './automation.service.js';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto, AutomationRuleQueryDto } from './dto/automation-rule.dto.js';
export declare class AutomationController {
    private readonly automationService;
    constructor(automationService: AutomationService);
    findAll(query: AutomationRuleQueryDto): Promise<import("./entities/automation-rule.entity.js").AutomationRule[]>;
    findOne(id: string): Promise<import("./entities/automation-rule.entity.js").AutomationRule>;
    create(dto: CreateAutomationRuleDto): Promise<import("./entities/automation-rule.entity.js").AutomationRule>;
    update(id: string, dto: UpdateAutomationRuleDto): Promise<import("./entities/automation-rule.entity.js").AutomationRule>;
    remove(id: string): Promise<void>;
    toggle(id: string): Promise<import("./entities/automation-rule.entity.js").AutomationRule>;
    execute(id: string): Promise<{
        executed: boolean;
        result?: string;
    }>;
}
