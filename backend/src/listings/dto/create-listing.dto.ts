import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export type ListingStatus =
  | 'draft'
  | 'ready'
  | 'published'
  | 'sold'
  | 'delisted'
  | 'archived';

export class CreateListingDto {
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() customLabelSku?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() categoryName?: string;
  @IsOptional() @IsString() cBrand?: string;
  @IsOptional() @IsString() cManufacturerPartNumber?: string;
  @IsOptional() @IsString() cOeOemPartNumber?: string;
  @IsOptional() @IsString() cType?: string;
  @IsOptional() @IsString() conditionId?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'startPrice must be a valid price (e.g. 19.99)' })
  startPrice?: string;
  @IsOptional() @IsString() quantity?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() itemPhotoUrl?: string;
  @IsOptional() @IsString() format?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() buyItNowPrice?: string;
  @IsOptional() @IsString() bestOfferEnabled?: string;
  @IsOptional() @IsString() bestOfferAutoAcceptPrice?: string;
  @IsOptional() @IsString() minimumBestOfferPrice?: string;
  @IsOptional() @IsString() immediatePayRequired?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() shippingService1Option?: string;
  @IsOptional() @IsString() shippingService1Cost?: string;
  @IsOptional() @IsString() shippingService2Option?: string;
  @IsOptional() @IsString() shippingService2Cost?: string;
  @IsOptional() @IsString() maxDispatchTime?: string;
  @IsOptional() @IsString() returnsAcceptedOption?: string;
  @IsOptional() @IsString() returnsWithinOption?: string;
  @IsOptional() @IsString() refundOption?: string;
  @IsOptional() @IsString() returnShippingCostPaidBy?: string;
  @IsOptional() @IsString() shippingProfileName?: string;
  @IsOptional() @IsString() returnProfileName?: string;
  @IsOptional() @IsString() paymentProfileName?: string;
  @IsOptional() @IsString() cItemHeight?: string;
  @IsOptional() @IsString() cItemLength?: string;
  @IsOptional() @IsString() cItemWidth?: string;
  @IsOptional() @IsString() cItemDiameter?: string;
  @IsOptional() @IsString() cFeatures?: string;
  @IsOptional() @IsString() cOperatingMode?: string;
  @IsOptional() @IsString() cFuelType?: string;
  @IsOptional() @IsString() cDriveType?: string;
  @IsOptional() @IsString() manufacturerName?: string;
  @IsOptional() @IsString() pUpc?: string;
  @IsOptional() @IsString() pEpid?: string;
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsString() relationshipDetails?: string;

  @IsOptional()
  @IsEnum(['draft', 'ready'], {
    message: 'New listings can only be created as "draft" or "ready"',
  })
  status?: 'draft' | 'ready';
}
