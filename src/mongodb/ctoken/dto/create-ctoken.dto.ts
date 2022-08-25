import { IsString, IsNotEmpty } from 'class-validator';

export class CtokenDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  price: number;
}

export default CtokenDto;
