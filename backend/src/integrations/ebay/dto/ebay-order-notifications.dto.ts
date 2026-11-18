import { IsBoolean, IsOptional } from 'class-validator';

export class EbayOrderNotificationsSubscribeDto {
  /**
   * eBay keeps one notification delivery URL per eBay app (shared by every
   * seller on it). Subscribing refuses to move a URL that points elsewhere
   * unless this is true.
   */
  @IsOptional()
  @IsBoolean()
  replaceApplicationUrl?: boolean;
}
