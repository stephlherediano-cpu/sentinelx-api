@'
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SentinelX Baseline API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/scan/transaction', () => {
    it('should reject missing fields (DTO validation)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/scan/transaction')
        .send({ chainId: 56 });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid transaction input');
    });

    it('should reject unexpected fields like privateKey (Security)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/scan/transaction')
        .send({
          chainId: 56,
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0',
          data: '0x',
          privateKey: '0x1234567890abcdef'
        });
      expect(response.status).toBe(400);
    });
  });
});
'@ | Set-Content -Path "test\baseline.e2e-spec.ts" -Encoding UTF8