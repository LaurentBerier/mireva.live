import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
export class AddBrandAdAccountDto {
  @IsIn(['meta', 'google', 'tiktok']) provider: string;
  @Matches(/^(act_)?[\d-]{3,40}$/) externalId: string;
  @IsString() @Length(1, 100) name: string;
  @IsString() @Length(10, 10000) token: string;
  @IsOptional() @IsString() @Length(1, 10000) refreshToken?: string;
  @IsOptional() @Matches(/^[\d-]{3,40}$/) loginAccountId?: string;
}
export class CreateBrandCampaignDto {
  @IsString() @Length(1, 200) name: string;
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.01)
  dailyBudget: number;
  @IsIn(['TRAFFIC', 'AWARENESS', 'ENGAGEMENT', 'LEADS', 'SALES'])
  objective: string;
  @IsOptional()
  @IsIn([
    'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    'CONTAINS_EU_POLITICAL_ADVERTISING',
  ])
  politicalDeclaration?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  specialAdCategories?: string[];
}
export class UpdateBrandCampaignDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED']) status?: 'ACTIVE' | 'PAUSED';
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.01)
  dailyBudget?: number;
}
