export declare class CreateAutomationRuleDto {
    name: string;
    description?: string;
    triggerType: 'schedule' | 'event' | 'condition';
    triggerConfig?: Record<string, unknown>;
    actionType: 'update_price' | 'sync_inventory' | 'publish' | 'end_listing' | 'notify' | 'apply_template';
    actionConfig?: Record<string, unknown>;
    conditions?: Record<string, unknown>[];
    enabled?: boolean;
    priority?: number;
    storeId?: string;
    channel?: string;
}
export declare class UpdateAutomationRuleDto {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    actionType?: string;
    actionConfig?: Record<string, unknown>;
    conditions?: Record<string, unknown>[];
    enabled?: boolean;
    priority?: number;
    storeId?: string;
    channel?: string;
}
export declare class AutomationRuleQueryDto {
    triggerType?: string;
    actionType?: string;
    enabled?: string;
    storeId?: string;
    channel?: string;
}
