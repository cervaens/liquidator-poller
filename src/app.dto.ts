import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryCandidateDto {
  @ApiPropertyOptional({
    description: `Protocol name`,
    example: 'Compound',
  })
  protocol: string;

  @ApiPropertyOptional({
    description: `Account address`,
  })
  account: string;
}

export class QueryLiquidateDto extends QueryCandidateDto {
  @ApiPropertyOptional({
    description: `Force liquidations by clearing all ongoing or blacklisted liquidations`,
  })
  force: boolean;
}

export class EnableDto {
  @ApiProperty()
  enabled: boolean;
}

export class ProtocolEnableDto {
  @ApiPropertyOptional({
    description: `Protocol name`,
    example: 'Compound',
  })
  protocol: string;

  @ApiProperty()
  enabled: boolean;
}
