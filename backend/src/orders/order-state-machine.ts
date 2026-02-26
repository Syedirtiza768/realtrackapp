/**
 * Order state machine — valid transitions enforced at service layer.
 */

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['processing', 'cancelled'],
  processing:       ['shipped', 'cancelled'],
  shipped:          ['delivered', 'disputed'],
  delivered:        ['completed', 'refund_requested', 'disputed'],
  completed:        ['refund_requested'],
  refund_requested: ['refunded', 'completed'], // refund denied → back to completed
  cancelled:        [],                        // terminal
  refunded:         [],                        // terminal
  disputed:         ['refunded', 'completed'],
};

export function canTransition(from: string, to: string): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidTransitions(status: string): string[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

export const ALL_ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS);
