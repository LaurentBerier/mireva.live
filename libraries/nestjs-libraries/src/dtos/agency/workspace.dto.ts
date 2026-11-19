import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';

export class CreateBrandDto {
  @IsString() @Length(1, 100) name: string;
  @IsString() @Length(1, 80) timezoneName = 'America/Toronto';
}
export class UpdateBrandDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @Length(1, 80) timezoneName?: string;
  @IsOptional() @IsBoolean() approvalRequired?: boolean;
}
export class InviteBrandMemberDto {
  @IsEmail() email: string;
  @IsIn(['ADMIN', 'USER', 'REVIEWER']) role: 'ADMIN' | 'USER' | 'REVIEWER';
}
export class UpdateBrandMemberDto {
  @IsOptional() @IsIn(['ADMIN', 'USER', 'REVIEWER']) role?:
    | 'ADMIN'
    | 'USER'
    | 'REVIEWER';
  @IsOptional() @IsBoolean() disabled?: boolean;
}
export class ReconcileBrandDeliveryDto {
  @IsIn(['PUBLISHED', 'NOT_PUBLISHED']) outcome: 'PUBLISHED' | 'NOT_PUBLISHED';
  @IsString() @Length(20, 2000) evidence: string;
  @IsOptional() @IsString() @Length(1, 500) externalId?: string;
  @IsOptional() @IsString() @Length(1, 2000) releaseUrl?: string;
}
export class RequestBrandReviewDto {
  @IsString() @Length(1, 100) group: string;
}
export class DecideBrandReviewDto {
  @IsIn(['APPROVED', 'CHANGES_REQUESTED']) state:
    | 'APPROVED'
    | 'CHANGES_REQUESTED';
  @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
export class InitializeBrandUploadDto {
  @IsString() @Length(1, 255) name: string;
  @IsString() @Length(1, 80) contentType: string;
  @IsInt() @Min(1) @Max(1073741824) size: number;
}
