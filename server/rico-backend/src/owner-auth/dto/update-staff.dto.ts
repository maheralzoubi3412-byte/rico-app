import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { OWNER_ROLES, OwnerRole } from '../schemas/owner-account.schema';

export class UpdateStaffDto {
  @IsOptional()
  @IsIn(OWNER_ROLES)
  role?: OwnerRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
