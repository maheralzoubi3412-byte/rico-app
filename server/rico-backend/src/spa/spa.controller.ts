import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

const CLIENT_DIST = join(__dirname, '..', '..', 'client', 'dist');

// The React (Vite) build's SPA page routes. ServeStaticModule only serves
// files that already exist under rootPath — it doesn't provide generic
// SPA-fallback behavior, so these routes are registered explicitly, same
// as the old Express app's SPA_PAGES loop.
@Controller()
export class SpaController {
  // Landing page linking to all the frontend sections below.
  @Get('dashboard')
  dashboard(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  @Get('submit-deal')
  submitDeal(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  @Get('business/login')
  businessLogin(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  @Get('business/dashboard')
  businessDashboard(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  @Get('admin/dashboard')
  adminDashboard(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  @Get('owner/dashboard')
  ownerDashboard(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }

  // Read-only public browse page for GET /businesses (the API endpoint
  // itself), listing all seeded/created businesses in a simple table.
  @Get('directory')
  directory(@Res() res: Response) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  }
}
