import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Liquidator API')
    .setDescription('The Liquidator API description')
    .setVersion('1.0')
    .addBasicAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const usersObj = {
    users: {},
  };

  usersObj.users[process.env.BLOCKNATIVE_USER] =
    process.env.BLOCKNATIVE_PASSWORD;

  usersObj.users[process.env.LIQUIDATOR_USER] = process.env.LIQUIDATOR_PASSWORD;

  app.use(basicAuth(usersObj));

  await app.listen(process.argv[2] || 3000);
}
bootstrap();
