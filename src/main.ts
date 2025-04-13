import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);

  // Use Winston for logging
  app.useLogger(logger);

  // Set global prefix for all routes
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  app.enableCors();

  // Use Helmet for security headers
  app.use(helmet());
  
  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Setup Swagger
  const options = new DocumentBuilder()
    .setTitle('Bill Vending API')
    .setDescription('API documentation for Bill Vending Service')
    .setVersion('1.0')
    .addTag('authentication', 'User registration and authentication')
    .addTag('wallet', 'Wallet management operations')
    .addTag('bills', 'Bill payment operations')
    .addTag('transactions', 'Transaction history and details')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  
  // Start the server
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  
  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger documentation is available at: http://localhost:${port}/${apiPrefix}/docs`);
}
bootstrap();