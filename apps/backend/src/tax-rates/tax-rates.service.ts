import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { CreateTaxRateDto, UpdateTaxRateDto } from './dto/index.js';

@Injectable()
export class TaxRatesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCountry(country?: string) {
    const value = country?.trim();
    return value && value.length > 0 ? value : null;
  }

  async list() {
    return this.prisma.taxRate.findMany({
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findActive() {
    return this.prisma.taxRate.findFirst({
      where: { isActive: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateTaxRateDto) {
    return this.prisma.taxRate.create({
      data: {
        name: dto.name.trim(),
        rate: dto.rate,
        country: this.normalizeCountry(dto.country),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTaxRateDto) {
    const existing = await this.prisma.taxRate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Tax rate not found');
    }

    return this.prisma.taxRate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
        ...(dto.country !== undefined
          ? { country: this.normalizeCountry(dto.country) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.taxRate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Tax rate not found');
    }

    await this.prisma.taxRate.delete({ where: { id } });
  }
}
