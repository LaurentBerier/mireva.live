import { IsString, IsUUID, Length } from 'class-validator';
export class PreviewBrandImportDto {
  @IsString() @Length(1, 500000) csv: string;
}
export class CommitBrandImportDto extends PreviewBrandImportDto {
  @IsUUID() requestId: string;
}
