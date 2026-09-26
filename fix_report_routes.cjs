const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const endpoints = [
  "app.get('/api/admin/report-sources', authenticateAdmin, async (req: Request, res: Response) => {",
  "app.get('/api/admin/report-sources/:id', authenticateAdmin, async (req: Request, res: Response) => {",
  "app.post('/api/admin/report-sources', authenticateAdmin, async (req: Request, res: Response) => {",
  "app.put('/api/admin/report-sources/:id', authenticateAdmin, async (req: Request, res: Response) => {",
  "app.get('/api/report-sources', authenticateUser, async (req: Request, res: Response) => {"
];

endpoints.forEach(ep => {
  code = code.replace(
    ep + "\n    try {",
    ep + "\n    try {\n      const supabaseAdmin = res.locals.supabaseAdmin;"
  );
});

fs.writeFileSync('server.ts', code);
