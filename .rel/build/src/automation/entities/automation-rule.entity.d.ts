export type TriggerType = 'schedule' | 'event' | 'condition';
export type ActionType = 'update_price' | 'sync_inventory' | 'publish' | 'end_listing' | 'notify' | 'apply_template';
export declare class AutomationRule {
    id: string;
    name: string;
    description: string | null;
    triggerType: TriggerType;
    triggerConfig: Record<string, unknown>;
    actionType: ActionType;
    actionConfig: Record<string, unknown>;
    conditions: Record<string, unknown>[];
    storeId: string | null;
    channel: string | null;
    enabled: boolean;
    priority: number;
    lastExecutedAt: Date | null;
    executionCount: number;
    createdAt: Date;
    updatedAt: Date;
}
