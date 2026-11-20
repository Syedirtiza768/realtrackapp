import type { ComplianceIssue } from './fashion-compliance.rules.js';
export declare function buildIssueFromError(message: string): ComplianceIssue;
export declare function preflightIssuesFromErrors(messages: string[]): ComplianceIssue[];
