"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ORDER_STATUSES = void 0;
exports.canTransition = canTransition;
exports.getValidTransitions = getValidTransitions;
const ORDER_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'disputed'],
    delivered: ['completed', 'refund_requested', 'disputed'],
    completed: ['refund_requested'],
    refund_requested: ['refunded', 'completed'],
    cancelled: [],
    refunded: [],
    disputed: ['refunded', 'completed'],
};
function canTransition(from, to) {
    return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
function getValidTransitions(status) {
    return ORDER_TRANSITIONS[status] ?? [];
}
exports.ALL_ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS);
//# sourceMappingURL=order-state-machine.js.map