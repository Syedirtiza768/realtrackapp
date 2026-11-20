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
exports.DemoSimulationLog = void 0;
const typeorm_1 = require("typeorm");
let DemoSimulationLog = class DemoSimulationLog {
    id;
    operationType;
    channel;
    storeId;
    listingId;
    instanceId;
    simulatedExternalId;
    requestPayload;
    responsePayload;
    simulatedLatencyMs;
    simulatedSuccess;
    simulatedError;
    notes;
    createdAt;
};
exports.DemoSimulationLog = DemoSimulationLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DemoSimulationLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'operation_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DemoSimulationLog.prototype, "operationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], DemoSimulationLog.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'instance_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'simulated_external_id',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "simulatedExternalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_payload', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "requestPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_payload', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "responsePayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'simulated_latency_ms', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], DemoSimulationLog.prototype, "simulatedLatencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'simulated_success', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DemoSimulationLog.prototype, "simulatedSuccess", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'simulated_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "simulatedError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], DemoSimulationLog.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], DemoSimulationLog.prototype, "createdAt", void 0);
exports.DemoSimulationLog = DemoSimulationLog = __decorate([
    (0, typeorm_1.Entity)('demo_simulation_logs'),
    (0, typeorm_1.Index)('idx_demo_log_operation', ['operationType']),
    (0, typeorm_1.Index)('idx_demo_log_channel', ['channel']),
    (0, typeorm_1.Index)('idx_demo_log_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_demo_log_created', ['createdAt'])
], DemoSimulationLog);
//# sourceMappingURL=demo-simulation-log.entity.js.map