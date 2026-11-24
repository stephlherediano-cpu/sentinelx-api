
import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { GoPlusAddressService } from './goplus-address.service';

@Controller('v1/intelligence/goplus')
export class GoPlusTestController {
  constructor(
    private readonly goPlusAddressService: GoPlusAddressService,
  ) {}

  @Get('address/:address')
  async checkAddress(
    @Param('address') address: string,
  ) {
    const result =
      await this.goPlusAddressService.checkAddress(address);

    return {
      success: true,
      network: 'BNB Smart Chain',
      chainId: 56,
      address,
      source: 'GoPlus Security',
      result,
    };
  }
}
