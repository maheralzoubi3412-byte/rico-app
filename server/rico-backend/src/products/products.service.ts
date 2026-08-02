import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductDto } from './dto/list-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    return this.productModel.create({
      businessId: dto.businessId,
      name: dto.name,
      category: dto.category ?? null,
      price: dto.price,
      attributes: dto.attributes ?? {},
      keywords: dto.keywords ?? [],
      finalPrice: dto.price, // no discount yet — PriceCalcService overrides this once one exists
    });
  }

  async findAll(query: ListProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { isActive: true };
    if (query.businessId) filter.businessId = query.businessId;

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException({ error: 'product_not_found' });
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const product = await this.findOne(id);
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.category !== undefined) product.category = dto.category;
    if (dto.attributes !== undefined) product.attributes = dto.attributes;
    if (dto.keywords !== undefined) product.keywords = dto.keywords;
    if (dto.price !== undefined) {
      product.price = dto.price;
      // Recomputed properly by PriceCalcService if an active discount
      // exists; this keeps finalPrice sane even with no discount at all.
      product.finalPrice = dto.price;
    }
    await product.save();
    return product;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await product.save();
  }

  async setFinalPrice(id: string, finalPrice: number): Promise<void> {
    await this.productModel.updateOne({ _id: id }, { $set: { finalPrice } });
  }
}
