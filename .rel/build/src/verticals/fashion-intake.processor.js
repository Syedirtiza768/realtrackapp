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
exports.FashionIntakeProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const fashion_intake_service_js_1 = require("./fashion-intake.service.js");
let FashionIntakeProcessor = class FashionIntakeProcessor extends bullmq_1.WorkerHost {
    intake;
    constructor(intake) {
        super();
        this.intake = intake;
    }
    async process(job) {
        return this.intake.processIdentification(job.data);
    }
};
exports.FashionIntakeProcessor = FashionIntakeProcessor;
exports.FashionIntakeProcessor = FashionIntakeProcessor = __decorate([
    (0, bullmq_1.Processor)(fashion_intake_service_js_1.FASHION_INTAKE_QUEUE, { concurrency: 2 }),
    __metadata("design:paramtypes", [fashion_intake_service_js_1.FashionIntakeService])
], FashionIntakeProcessor);
//# sourceMappingURL=fashion-intake.processor.js.map