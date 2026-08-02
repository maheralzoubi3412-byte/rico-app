import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { OWNER_ROLES, OwnerRole } from '../schemas/owner-account.schema';

export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(OWNER_ROLES)
  role: OwnerRole;
}
