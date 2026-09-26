import { Request, Response } from 'express';
import { usageTrackingService } from './usageTracking.service';

export class UsageController {
  /**
   * GET /api/ai/usage/me
   */
  getPersonalUsage = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id || res.locals.userId;
      const supabaseAdmin = res.locals.supabaseAdmin || (req as any).supabaseAdmin;

      if (!userId) {
        res.status(401).json({ error: 'Chưa xác thực người dùng.' });
        return;
      }

      const usage = await usageTrackingService.getPersonalUsage(supabaseAdmin, userId);
      res.json(usage);
    } catch (err: any) {
      console.error('[UsageController:getPersonalUsage] Error:', err?.message);
      res.status(500).json({ error: 'Không thể tải thông tin hạn mức cá nhân.' });
    }
  };

  /**
   * GET /api/admin/ai/usage/summary
   * Requires ai.usage.view capability
   */
  getAdminSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
      const summary = await usageTrackingService.getAdminSummary(supabaseAdmin);
      res.json(summary);
    } catch (err: any) {
      console.error('[UsageController:getAdminSummary] Error:', err?.message);
      res.status(500).json({ error: 'Không thể tải thống kê sử dụng AI.' });
    }
  };

  /**
   * GET /api/admin/ai/usage-settings
   * Requires ai.config.manage capability
   */
  getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
      const settings = await usageTrackingService.getSettings(supabaseAdmin);
      res.json(settings);
    } catch (err: any) {
      console.error('[UsageController:getSettings] Error:', err?.message);
      res.status(500).json({ error: 'Không thể tải cấu hình hạn mức AI.' });
    }
  };

  /**
   * PATCH /api/admin/ai/usage-settings
   * Requires ai.config.manage capability
   */
  updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const supabaseAdmin = res.locals.supabaseAdmin || (req as any).supabaseAdmin;
      const updates = req.body || {};

      // Validate non-negative numbers
      for (const key of Object.keys(updates)) {
        if (typeof updates[key] === 'number' && updates[key] < 0) {
          res.status(400).json({ error: `Giá trị của ${key} không được là số âm.` });
          return;
        }
      }

      const updated = await usageTrackingService.updateSettings(supabaseAdmin, updates);
      res.json(updated);
    } catch (err: any) {
      console.error('[UsageController:updateSettings] Error:', err?.message);
      res.status(500).json({ error: 'Không thể cập nhật cấu hình hạn mức AI.' });
    }
  };
}

export const usageController = new UsageController();
