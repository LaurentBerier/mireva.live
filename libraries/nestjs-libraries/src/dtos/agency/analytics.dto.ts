import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
export class AgencyRangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
export class AddCompetitorDto {
  @IsIn([
    'facebook',
    'instagram',
    'threads',
    'x',
    'bluesky',
    'youtube',
    'twitch',
  ])
  provider: string;
  @IsString() @Length(1, 255) handle: string;
}
export class AnalyzeBrandDto extends AgencyRangeDto {
  @IsString() @Length(1, 2000) question: string;
}
