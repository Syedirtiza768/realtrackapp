import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationRule } from './entities/automation-rule.entity.js';
import type {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  AutomationRuleQueryDto,
} from './dto/automation-rule.dto.js';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepo: Repository<AutomationRule>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /* ─── CRUD ─── */

  async findAll(query?: AutomationRuleQueryDto): Promise<AutomationRule[]> {
    const qb = this.ruleRepo.createQueryBuilder('r');

    if (query?.triggerType) {
      qb.andWhere('r.triggerType = :triggerType', { triggerType: query.triggerType });
    }
    if (query?.actionType) {
      qb.andWhere('r.actionType = :actionType', { actionType: query.actionType });
    }
    if (query?.enabled === 'true' || query?.enabled === 'false') {
      qb.andWhere('r.enabled = :enabled', { enabled: query.enabled === 'true' });
    }
    if (query?.storeId) {
      qb.andWhere('(r.storeId = :storeId OR r.storeId IS NULL)', { storeId: query.storeId });
    }
    if (query?.channel) {
      qb.andWhere('(r.channel = :channel OR r.channel IS NULL)', { channel: query.channel });
    }

    return qb.orderBy('r.priority', 'DESC').addOrderBy('r.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<AutomationRule> {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) throw new NotFoundException(`Automation rule ${id} not found`);
    return rule;
  }

  async create(dto: CreateAutomationRuleDto): Promise<AutomationRule> {
    const rule = this.ruleRepo.create(dto as Partial<AutomationRule>);
    const saved = await this.ruleRepo.save(rule);
    this.eventEmitter.emit('automation.rule_created', { ruleId: saved.id, name: saved.name });
    this.logger.log(`Created automation rule: ${saved.name} (${saved.id})`);
    return saved;
  }

  async update(id: string, dto: UpdateAutomationRuleDto): Promise<AutomationRule> {
    const rule = await this.findOne(id);
    Object.assign(rule, dto);
    const saved = await this.ruleRepo.save(rule);
    this.eventEmitter.emit('automation.rule_updated', { ruleId: saved.id, name: saved.name });
    return saved;
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    await this.ruleRepo.remove(rule);
    this.eventEmitter.emit('automation.rule_deleted', { ruleId: id, name: rule.name });
    this.logger.log(`Deleted automation rule: ${rule.name} (${id})`);
  }

  async toggle(id: string): Promise<AutomationRule> {
    const rule = await this.findOne(id);
    rule.enabled = !rule.enabled;
    return this.ruleRepo.save(rule);
  }

  /* ─── Execution ─── */

  /**
   * Evaluate and execute a single rule. Called by the rule evaluation scheduler
   * or manual trigger. Returns true if the action was executed.
   */
  async execute(id: string): Promise<{ executed: boolean; result?: string }> {
    const rule = await this.findOne(id);

    if (!rule.enabled) {
      return { executed: false, result: 'Rule is disabled' };
    }

    // Evaluate conditions
    const conditionsMet = this.evaluateConditions(rule.conditions);
    if (!conditionsMet) {
      return { executed: false, result: 'Conditions not met' };
    }

    // Execute action by emitting an event for the appropriate handler
    this.logger.log(`Executing rule "${rule.name}" (${rule.actionType})`);

    this.eventEmitter.emit(`automation.execute.${rule.actionType}`, {
      ruleId: rule.id,
      ruleName: rule.name,
      actionConfig: rule.actionConfig,
      triggerConfig: rule.triggerConfig,
    });

    // Update execution stats
    rule.lastExecutedAt = new Date();
    rule.executionCount += 1;
    await this.ruleRepo.save(rule);

    return { executed: true, result: `Action ${rule.actionType} dispatched` };
  }

  /**
   * Evaluate all enabled rules that match a specific trigger type.
   * Called by scheduler for schedule-based rules, or by event listeners for event-based rules.
   */
  async evaluateByTrigger(
    triggerType: string,
    context?: Record<string, unknown> & { storeId?: string; channel?: string },
  ): Promise<number> {
    const qb = this.ruleRepo
      .createQueryBuilder('r')
      .where('r.triggerType = :triggerType', { triggerType })
      .andWhere('r.enabled = true')
      .orderBy('r.priority', 'DESC');

    if (context?.storeId) {
      qb.andWhere('(r.storeId = :storeId OR r.storeId IS NULL)', { storeId: context.storeId });
    }
    if (context?.channel) {
      qb.andWhere('(r.channel = :channel OR r.channel IS NULL)', { channel: context.channel });
    }

    const rules = await qb.getMany();

    let executed = 0;
    for (const rule of rules) {
      const result = await this.execute(rule.id);
      if (result.executed) executed++;
    }

    this.logger.log(`Evaluated ${rules.length} ${triggerType} rules, executed ${executed}`);
    return executed;
  }

  /* ─── Internals ─── */

  private evaluateConditions(conditions: Record<string, unknown>[]): boolean {
    if (!conditions || conditions.length === 0) return true;

    // Phase 2 basic evaluation: simple field/operator/value conditions
    // In a future phase, this can support complex expressions, nested groups, etc.
    for (const condition of conditions) {
      const { field, operator, value } = condition as {
        field?: string;
        operator?: string;
        value?: unknown;
      };

      if (!field || !operator) continue;

      // For now, all conditions are considered met.
      // Real evaluation will be wired when we have listing context injection.
      this.logger.debug(`Condition: ${field} ${operator} ${JSON.stringify(value)} — auto-pass (Phase 2 stub)`);
    }

    return true;
  }
}
