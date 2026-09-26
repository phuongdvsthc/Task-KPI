const fs = require('fs');

let types = fs.readFileSync('src/types/daily-report.ts', 'utf8');
types = types.replace("export interface SaveDailyReportPayload {", "export interface SaveDailyReportPayload {\n  id?: string;");
fs.writeFileSync('src/types/daily-report.ts', types);

let service = fs.readFileSync('src/services/daily-report.service.ts', 'utf8');
const search = `    // UPSERT based on user_id, organization_unit_id, report_date, source_channel
    // Wait, since we might not have a unique constraint on these 4 columns, we might need to query first.
    // Let's query if it exists.
    const { data: existing, error: findErr } = await this.fetchWithRetry(async () => await 
      (supabase.from as any)('daily_reports')
        .select('id')
        .eq('user_id', payload.user_id)
        .eq('organization_unit_id', payload.organization_unit_id)
        .eq('report_date', payload.report_date)
        .eq('source_channel', payload.source_channel)
        .maybeSingle()
    );

    if (findErr) throw new Error('Lỗi kiểm tra báo cáo: ' + findErr.message);

    if (existing) {`;

const replace = `    let existing: any = null;
    if (payload.id) {
       const { data, error } = await this.fetchWithRetry(async () => await (supabase.from as any)('daily_reports').select('id').eq('id', payload.id).maybeSingle());
       if (error) throw new Error('Lỗi kiểm tra báo cáo: ' + error.message);
       existing = data;
    } else {
       const { data, error } = await this.fetchWithRetry(async () => await 
         (supabase.from as any)('daily_reports')
           .select('id')
           .eq('user_id', payload.user_id)
           .eq('organization_unit_id', payload.organization_unit_id)
           .eq('report_date', payload.report_date)
           .eq('source_channel', payload.source_channel)
           .maybeSingle()
       );
       if (error) throw new Error('Lỗi kiểm tra báo cáo: ' + error.message);
       existing = data;
    }

    if (existing) {`;
    
service = service.replace(search, replace);
fs.writeFileSync('src/services/daily-report.service.ts', service);

let form = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');
form = form.replace("const payload: SaveDailyReportPayload = {", "const payload: SaveDailyReportPayload = {\n            id: id || undefined,");
fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', form);
