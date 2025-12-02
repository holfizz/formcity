import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelegrafModule } from 'nestjs-telegraf'
import { BotModule } from './bot/bot.module'
import { CsvModule } from './csv/csv.module'
import { ExcelModule } from './excel/excel.module'
import { OpenAiModule } from './openai/openai.module'
import { WebScrapingModule } from './web-scraping/web-scraping.module'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
		}),
		TelegrafModule.forRoot({
			token: process.env.TELEGRAM_BOT_TOKEN,
		}),
		BotModule,
		CsvModule,
		ExcelModule,
		WebScrapingModule,
		OpenAiModule,
	],
})
export class AppModule {}
