import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
export class CreateBrandReportDto {
  @IsString() @Length(1, 120) name: string;
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsIn(['pdf', 'pptx', 'csv']) format: 'pdf' | 'pptx' | 'csv';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(28) monthlyDay?: number;
  @IsOptional() @IsString() @Length(1, 100) logoMediaId?: string;
  @IsOptional() @Matches(/^[A-Fa-f0-9]{6}$/) accentColor?: string;
  @IsOptional()
  @IsIn(['FIXED', 'CURRENT_MONTH', 'PREVIOUS_MONTH', 'CURRENT_WEEK'])
  period?: string;
}
