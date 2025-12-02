import { Module } from '@nestjs/common'
import { CsvModule } from '../csv/csv.module'
import { ExcelModule } from '../excel/excel.module'
import { OpenAiModule } from '../openai/openai.module'
import { SearchModule } from '../search/search.module'
import { WebScrapingModule } from '../web-scraping/web-scraping.module'
import { BotService } from './bot.service'

@Module({
	imports: [
		CsvModule,
		ExcelModule,
		WebScrapingModule,
		OpenAiModule,
		SearchModule,
	],
	providers: [BotService],
})
export class BotModule {}
