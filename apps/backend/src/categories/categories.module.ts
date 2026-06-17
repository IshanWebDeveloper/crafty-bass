import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { SkillsController } from './skills.controller.js';

@Module({
  controllers: [CategoriesController, SkillsController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
