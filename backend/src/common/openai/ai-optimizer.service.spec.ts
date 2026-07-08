import { AiOptimizerService } from './ai-optimizer.service.js';

describe('AiOptimizerService.computeReward', () => {
  const service = Object.create(
    AiOptimizerService.prototype,
  ) as AiOptimizerService;

  it('rewards high approval, pass rate, and compliance', () => {
    const reward = service.computeReward({
      humanApprovalRate: 1,
      firstPassRate: 1,
      publishSuccessRate: 1,
      avgCost: 0.002,
      escalationRate: 0,
      avgComplianceScore: 0.95,
      hardFailRate: 0,
      publishErrorRate: 0,
    });
    expect(reward).toBeGreaterThan(0.85);
  });

  it('penalizes hard fails and publish errors', () => {
    const good = service.computeReward({
      humanApprovalRate: 0.9,
      firstPassRate: 0.9,
      publishSuccessRate: 0.9,
      avgCost: 0.003,
      escalationRate: 0.1,
      avgComplianceScore: 0.9,
      hardFailRate: 0,
      publishErrorRate: 0,
    });
    const bad = service.computeReward({
      humanApprovalRate: 0.9,
      firstPassRate: 0.9,
      publishSuccessRate: 0.9,
      avgCost: 0.003,
      escalationRate: 0.1,
      avgComplianceScore: 0.9,
      hardFailRate: 0.4,
      publishErrorRate: 0.5,
    });
    expect(bad).toBeLessThan(good);
  });
});
