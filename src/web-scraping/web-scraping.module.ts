import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WebScrapingService } from './web-scraping.service';

@Module({
  imports: [HttpModule],
  providers: [WebScrapingService],
  exports: [WebScrapingService],
})
export class WebScrapingModule {}