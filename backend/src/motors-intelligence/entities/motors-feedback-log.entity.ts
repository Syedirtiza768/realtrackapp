import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum FeedbackType {
  REVIEWER_CORRECTION = 'reviewer_correction',
  TITLE_EDIT = 'title_edit',
  FITMENT_EDIT = 'fitment_edit',
  SPECIFICS_EDIT = 'specifics_edit',
  EBAY_API_ERROR = 'ebay_api_error',
  POLICY_REJECTION = 'policy_rejection',
  RETURN_INAD = 'return_inad',
  CTR_DATA = 'ctr_data',
  SELL_THROUGH = 'sell_through',
  BRAND_CORRECTION = 'brand_correction',
  MPN_CORRECTION = 'mpn_correction',
  CATEGORY_CORRECTION = 'category_correction',
}

@Entity('motors_feedback_logs')
@Index('idx_feedback_motors_product', ['motorsProductId'])
@Index('idx_feedback_type', ['feedbackType'])
@Index('idx_feedback_created', ['createdAt'])
export class MotorsFeedbackLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  motorsProductId: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewTaskId: string | null;

  @Column({ type: 'enum', enum: FeedbackType })
  feedbackType: FeedbackType;

  @Column({ type: 'text', nullable: true })
  field: string | null;

  @Column({ type: 'text', nullable: true })
  originalValue: string | null;

  @Column({ type: 'text', nullable: true })
  correctedValue: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  appliedToRules: boolean;

  @Column({ type: 'uuid', nullable: true })
  generatedCorrectionRuleId: string | null;

  @Column({ type: 'text', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
