import 'reflect-metadata';
import helmet from 'helmet';
import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // --- SWAGGER SETUP ---
  const config = new DocumentBuilder()
    .setTitle('SentinelX Core Engine API')
    .setDescription(
      'Universal Crypto Security Layer. Provides transaction simulation, ' +
      'risk intelligence, DEX swap decoding, and smart contract scanning.',
    )
    .setVersion('0.2.0')
    .addTag('Simulation', 'Transaction simulation and verification')
    .addTag('Intelligence', 'Transaction decoding and risk assessment')
    .addTag('Scanner', 'Smart contract bytecode analysis')
    .addTag('Blockchain', 'Blockchain health and status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  // --- END SWAGGER SETUP ---

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  console.log(`SentinelX API listening on http://localhost:${port}`);
  console.log(`Swagger Documentation: http://localhost:${port}/api`);
}

bootstrap();