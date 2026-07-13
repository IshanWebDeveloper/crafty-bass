import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { generateSlug } from '../common/utils/slug.util.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/index.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.serviceCategory.findMany({
      include: { children: true },
      orderBy: { nameEn: 'asc' },
    });

    // Build tree from flat list
    const rootCategories = categories.filter((c) => !c.parentId);
    return rootCategories.map((root) => this.buildTree(root, categories));
  }

  private buildTree(
    parent: { id: string; [key: string]: unknown },
    all: Array<{ id: string; parentId: string | null; [key: string]: unknown }>,
  ): unknown {
    const children = all.filter((c) => c.parentId === parent.id);
    return {
      ...parent,
      children: children.map((child) => this.buildTree(child, all)),
    };
  }

  // Live count of verified, available tradesmen per category, keyed by slug.
  // A tradesman is counted for a category when they hold at least one skill in
  // it. Powers the landing-page category cards; small category set + a 5-min
  // controller cache keep the per-category counts cheap.
  async getTradesmanCounts(): Promise<Array<{ slug: string; count: number }>> {
    const categories = await this.prisma.serviceCategory.findMany({
      select: { id: true, slug: true },
    });

    const counts = await Promise.all(
      categories.map((category) =>
        this.prisma.tradesmanProfile.count({
          where: {
            isVerified: true,
            isAvailable: true,
            skills: { some: { skill: { categoryId: category.id } } },
          },
        }),
      ),
    );

    return categories.map((category, i) => ({
      slug: category.slug,
      count: counts[i],
    }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);

    const existing = await this.prisma.serviceCategory.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.serviceCategory.create({
      data: {
        nameEn: dto.name,
        slug,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.nameEn = dto.name;
      data.slug = generateSlug(dto.name);

      const existing = await this.prisma.serviceCategory.findUnique({
        where: { slug: data.slug as string },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      data.parentId = dto.parentId;
    }

    return this.prisma.serviceCategory.update({ where: { id }, data });
  }

  async remove(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: { _count: { select: { children: true, jobs: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.children > 0) {
      throw new ConflictException(
        'Cannot delete category with child categories',
      );
    }

    if (category._count.jobs > 0) {
      throw new ConflictException('Cannot delete category with linked jobs');
    }

    return this.prisma.serviceCategory.delete({ where: { id } });
  }
}
