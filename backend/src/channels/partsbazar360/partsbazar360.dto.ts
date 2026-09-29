import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConnectPartsBazar360Dto {
  /** Label shown in RealTrack for this destination. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  storeName!: string;

  /**
   * The seller's `storeId` on PartsBazar360 — the RealTrack store id that
   * seller was onboarded against (e.g. Blackline's eBay store id).
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sellerStoreId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountName?: string;
}
