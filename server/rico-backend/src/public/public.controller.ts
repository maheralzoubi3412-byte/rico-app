import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PublicService } from './public.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { SubmitDealDto } from './dto/submit-deal.dto';
import { TrackImpressionsDto } from './dto/track-impressions.dto';
import { TrackSearchGapDto } from './dto/track-search-gap.dto';

@Controller()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('places/search')
  searchPlaces(@Query() query: SearchPlacesDto) {
    return this.publicService.searchPlaces(query.q);
  }

  @Post('submit-deal')
  submitDeal(@Body() dto: SubmitDealDto) {
    return this.publicService.submitDeal(dto);
  }

  @Post('impressions')
  trackImpressions(@Body() dto: TrackImpressionsDto) {
    return this.publicService.trackImpressions(dto.items);
  }

  @Post('search-gaps')
  trackSearchGap(@Body() dto: TrackSearchGapDto) {
    return this.publicService.trackSearchGap(dto);
  }
}
