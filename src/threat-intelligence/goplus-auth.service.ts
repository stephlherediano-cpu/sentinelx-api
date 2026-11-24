
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

interface GoPlusTokenResponse {
  code?: number;
  message?: string;
  result?: {
    access_token?: string;
  };
}

@Injectable()
export class GoPlusAuthService {
private readonly logger = new Logger(GoPlusAuthService.name);
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    const appKey = this.configService.get<string>(
      'GOPLUS_APP_KEY',
    );

    const appSecret = this.configService.get<string>(
      'GOPLUS_APP_SECRET',
    );

    if (!appKey || !appSecret) {
      throw new InternalServerErrorException(
        'GoPlus credentials are not configured.',
      );
    }

    const time = Math.floor(Date.now() / 1000);

    const signature = createHash('sha1')
      .update(`${appKey}${time}${appSecret}`)
      .digest('hex');

    try {
      const response = await fetch(
        'https://api.gopluslabs.io/api/v1/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_key: appKey,
            time,
            sign: signature,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `GoPlus authentication HTTP ${response.status}`,
        );
      }

      const result =
        (await response.json()) as GoPlusTokenResponse;

this.logger.log(
  `GoPlus auth response: code=${result.code}, message=${result.message}, hasAccessToken=${Boolean(result.result?.access_token)}, tokenHasBearerPrefix=${result.result?.access_token?.startsWith('Bearer ') ?? false}`,
);

      if (result.code !== 1) {
        throw new Error(
          result.message || 'GoPlus authentication failed.',
        );
      }

      const accessToken = result.result?.access_token;

      if (
        typeof accessToken !== 'string' ||
        accessToken.length === 0
      ) {
        throw new Error(
          'GoPlus access token was not returned.',
        );
      }

      return accessToken;
    } catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown error';

  this.logger.error(`GoPlus authentication failed: ${message}`);

  throw new ServiceUnavailableException(
    'Unable to authenticate with GoPlus Security API.',
  );
}
  }
}
