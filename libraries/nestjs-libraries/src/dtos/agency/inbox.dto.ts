import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
export class ReplyBrandMessageDto {
  @IsString() @Length(1, 5000) content: string;
  @IsUUID() requestId: string;
}
export class AssignBrandConversationDto {
  @IsOptional() @IsUUID() assignedTo?: string | null;
  @IsOptional() @IsIn(['OPEN', 'RESOLVED']) status?: string;
}
export class SavedBrandReplyDto {
  @IsString() @Length(1, 100) title: string;
  @IsString() @Length(1, 5000) content: string;
}
export class CreateBrandFlowDto {
  @IsString() @Length(1, 100) integrationId: string;
  @IsString() @Length(1, 100) name: string;
  @IsString() @Length(1, 100) keyword: string;
  @IsOptional() @IsString() @Length(1, 200) postExternalId?: string;
  @IsOptional() @IsString() @Length(1, 5000) publicReply?: string;
  @IsOptional() @IsString() @Length(1, 5000) directReply?: string;
}
export class ToggleBrandFlowDto {
  @IsBoolean() enabled: boolean;
}
