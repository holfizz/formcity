import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { SearchService } from './search.service'

@Module({
	imports: [HttpModule],
	providers: [SearchService],
	exports: [SearchService],
})
export class SearchModule {}
