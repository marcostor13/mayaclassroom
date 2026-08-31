import { IsMongoId } from 'class-validator';

export class IdParamDto {
  @IsMongoId({ message: 'El identificador no es válido.' })
  id!: string;
}
