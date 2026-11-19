import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
export class BrandLinkDto {
  @IsString() @Matches(/^[\w-]{1,60}$/) id: string;
  @IsString() @Length(1, 120) label: string;
  @IsUrl({ protocols: ['https'], require_protocol: true }) url: string;
}
export class SaveBrandLinkPageDto {
  @IsOptional() @IsString() @Length(1, 100) id?: string;
  @Matches(/^[a-z0-9][a-z0-9-]{2,60}$/) slug: string;
  @IsString() @Length(1, 120) title: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsIn(['violet', 'ocean', 'forest', 'monochrome']) theme: string;
  @IsBoolean() published: boolean;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BrandLinkDto)
  links: BrandLinkDto[];
}
export class CreateBrandWebsiteDto {
  @IsString() @Length(1, 253) domain: string;
}
export class TrackBrandVisitDto {
  @IsString() @Length(1, 2048) pathname: string;
  @IsOptional() @IsString() @Length(0, 2048) referrer?: string;
}
