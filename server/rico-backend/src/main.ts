import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Render (and most PaaS) sit behind one reverse-proxy hop — needed so
  // req.ip / rate-limiting see the real client IP, not the proxy's.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const mongoUri = process.env.MONGODB_URI;
  const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev_only_insecure_secret_change_me',
      resave: false,
      saveUninitialized: false,
      rolling: true, // refresh expiry on every response so active use never gets logged out mid-session
      store: MongoStore.create({
        mongoUrl: mongoUri,
        collectionName: 'business_sessions',
        ttl: SESSION_MAX_AGE_MS / 1000, // keep the store's TTL in sync with the cookie — it defaults to 14 days otherwise
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`rico-backend listening on :${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
