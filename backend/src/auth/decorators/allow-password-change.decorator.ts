import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChangeRequired';
/** Only for authenticated self-service endpoints needed to finish password setup. */
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
