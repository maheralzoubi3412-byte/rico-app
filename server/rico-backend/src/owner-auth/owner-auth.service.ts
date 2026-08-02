import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OwnerAccount, OwnerAccountDocument, OwnerRole } from './schemas/owner-account.schema';
import { hashPassword, verifyPassword } from '../common/utils/auth.util';

const DEFAULT_OWNER_EMAIL = 'owner@rico.app';
const DEFAULT_OWNER_PASSWORD = 'ChangeMe123!';

@Injectable()
export class OwnerAuthService implements OnModuleInit {
  private readonly logger = new Logger(OwnerAuthService.name);

  constructor(@InjectModel(OwnerAccount.name) private readonly ownerModel: Model<OwnerAccountDocument>) {}

  // First-run bootstrap only — if any owner account already exists this is
  // a no-op, so a manually-set password is never silently overwritten on
  // every restart. Set OWNER_EMAIL/OWNER_PASSWORD before the first boot to
  // control the initial login; otherwise a documented dev-only default is used.
  async onModuleInit(): Promise<void> {
    const existing = await this.ownerModel.countDocuments({});
    if (existing > 0) return;

    const email = (process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
    const password = process.env.OWNER_PASSWORD || DEFAULT_OWNER_PASSWORD;
    await this.ownerModel.create({ email, passwordHash: hashPassword(password), role: 'owner' });

    if (!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD) {
      this.logger.warn(
        `Created default owner account ${email} with a well-known password — set OWNER_EMAIL/OWNER_PASSWORD env vars and log in again to change it.`,
      );
    } else {
      this.logger.log(`Created owner account ${email} from OWNER_EMAIL/OWNER_PASSWORD.`);
    }
  }

  async login(rawEmail: string, password: string): Promise<{ ownerId: string; role: OwnerRole; email: string }> {
    const email = (rawEmail || '').trim().toLowerCase();
    const owner = await this.ownerModel.findOne({ email });
    if (!owner || !owner.isActive || !verifyPassword(password || '', owner.passwordHash)) {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }

    owner.lastLoginAt = new Date();
    await owner.save();
    return { ownerId: String(owner._id), role: owner.role, email: owner.email };
  }

  async me(ownerId: string): Promise<{ id: string; email: string; role: OwnerRole }> {
    const owner = await this.ownerModel.findById(ownerId).lean();
    if (!owner || !owner.isActive) throw new UnauthorizedException({ error: 'unauthorized' });
    return { id: String(owner._id), email: owner.email, role: owner.role };
  }

  async listStaff() {
    const accounts = await this.ownerModel.find({}).sort({ createdAt: 1 }).lean();
    return {
      items: accounts.map((a) => ({
        id: a._id,
        email: a.email,
        role: a.role,
        isActive: a.isActive,
        lastLoginAt: a.lastLoginAt,
      })),
    };
  }

  async createStaff(email: string, password: string, role: OwnerRole) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.ownerModel.findOne({ email: normalizedEmail }).lean();
    if (existing) throw new ConflictException({ error: 'email_already_exists' });

    const created = await this.ownerModel.create({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role,
    });
    return { id: created._id, email: created.email, role: created.role };
  }

  async updateStaff(
    requesterId: string,
    targetId: string,
    updates: { role?: OwnerRole; isActive?: boolean },
  ) {
    if (requesterId === targetId && (updates.role === 'staff' || updates.isActive === false)) {
      throw new BadRequestException({ error: 'cannot_demote_or_disable_self' });
    }

    const target = await this.ownerModel.findById(targetId);
    if (!target) throw new NotFoundException({ error: 'account_not_found' });

    if ((updates.role === 'staff' || updates.isActive === false) && target.role === 'owner') {
      const remainingActiveOwners = await this.ownerModel.countDocuments({
        role: 'owner',
        isActive: true,
        _id: { $ne: targetId },
      });
      if (remainingActiveOwners === 0) {
        throw new ForbiddenException({ error: 'last_owner_cannot_be_demoted' });
      }
    }

    if (updates.role !== undefined) target.role = updates.role;
    if (updates.isActive !== undefined) target.isActive = updates.isActive;
    await target.save();

    return { id: target._id, email: target.email, role: target.role, isActive: target.isActive };
  }
}
