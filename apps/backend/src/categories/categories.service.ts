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
    const categories = await this.prisma.category.findMany({
      include: { children: true },
      orderBy: { name: 'asc' },
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

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
        products: { where: { isActive: true }, take: 10 },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = generateSlug(dto.name);

      const existing = await this.prisma.category.findUnique({
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

    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.children > 0) {
      throw new ConflictException(
        'Cannot delete category with child categories',
      );
    }

    if (category._count.products > 0) {
      throw new ConflictException('Cannot delete category with products');
    }

    return this.prisma.category.delete({ where: { id } });
  }
}
