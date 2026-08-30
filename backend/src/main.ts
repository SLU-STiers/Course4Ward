import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Client } from 'pg';
import { AppModule } from './app.module';

async function testDatabaseConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('DATABASE_URL is not set. Skipping database connection test.');
    return false;
  }

  const maskedUrl = connectionString.replace(/\/\/([^@]+)@/, '//***@');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query('SELECT 1 AS ok');
    console.log(`Database connected successfully: ${maskedUrl}`);
    console.log('Postgres verification query result:', result.rows[0]);
    return true;
  } catch (error) {
    console.error(`Database connection failed: ${maskedUrl}`);
    console.error(error);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('SLU Sacred Heart CIMS API')
    .setDescription(
      'Clinical Information Management System — auth, orders, notes, ' +
        'Course in the Ward summaries, claims, and admin endpoints.',
    )
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const dbConnected = await testDatabaseConnection();
  if (dbConnected) {
    console.log('Database readiness check: OK');
  } else {
    console.warn('Database readiness check: FAILED');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`CIMS backend running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
