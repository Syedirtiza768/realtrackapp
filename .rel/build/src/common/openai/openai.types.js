"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENAI_PRICING = void 0;
exports.estimateCost = estimateCost;
exports.OPENAI_PRICING = {
    'openai/gpt-4.1-mini': { input: 0.4, output: 1.6 },
    'openai/gpt-6-luna': { input: 0.1, output: 0.5 },
    'openai/gpt-5.6-luna': { input: 0.2, output: 1.2 },
    'openai/gpt-5.6-luna-20260709': { input: 0.2, output: 1.2 },
    'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
    'google/gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
    'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
    'google/gemma-4-31b-it': { input: 0.09, output: 0.34 },
    'deepseek/deepseek-chat-v3-0324': { input: 0.27, output: 1.1 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
    'minimax/minimax-m3': { input: 0.3, output: 1.2 },
    'gpt-5.4': { input: 2.5, output: 10.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'text-embedding-3-small': { input: 0.02, output: 0 },
    'text-embedding-3-large': { input: 0.13, output: 0 },
};
function estimateCost(model, promptTokens, completionTokens) {
    const pricing = exports.OPENAI_PRICING[model] ?? exports.OPENAI_PRICING['openai/gpt-4.1-mini'];
    return ((promptTokens / 1_000_000) * pricing.input +
        (completionTokens / 1_000_000) * pricing.output);
}
//# sourceMappingURL=openai.types.js.map