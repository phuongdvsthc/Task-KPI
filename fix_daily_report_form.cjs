const fs = require('fs');

const file = 'src/components/daily-reports/DailyReportFormView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add ReportSource interface
code = code.replace(
  "export const DailyReportFormView: React.FC<{ id?: string }> = ({ id }) => {",
  `interface ReportSource {
  id: string;
  name: string;
}

export const DailyReportFormView: React.FC<{ id?: string }> = ({ id }) => {`
);

// 2. Remove CHANNELS constant
code = code.replace(/const CHANNELS = \[[\s\S]*?\];/, '');

// 3. Add reportSources state and change sourceChannel logic
code = code.replace(
  "const [sourceChannel, setSourceChannel] = useState(CHANNELS[0]);",
  "const [reportSources, setReportSources] = useState<ReportSource[]>([]);\n  const [sourceChannel, setSourceChannel] = useState('');\n  const [reportSourceId, setReportSourceId] = useState('');"
);

// 4. Update loadData in useEffect
code = code.replace(
  "const unitId = orgMembers?.[0]?.organization_unit_id;",
  `const unitId = orgMembers?.[0]?.organization_unit_id;
        
        // Load report sources for this unit
        try {
          const res = await fetch(\`/api/report-sources?organization_unit_id=\${unitId}\`, {
            headers: { Authorization: \`Bearer \${session?.access_token}\` }
          });
          if (res.ok) {
            const sources = await res.json();
            setReportSources(sources);
            if (!isEdit && sources.length > 0) {
              setReportSourceId(sources[0].id);
              setSourceChannel(sources[0].name);
            }
          }
        } catch (e) {
          console.error('Failed to load report sources', e);
        }`
);

// Also need `session` for the fetch
code = code.replace(
  "const { user } = useAuth();",
  "const { user, session } = useAuth();"
);

// 5. Update edit mode loading to handle report_source_id
code = code.replace(
  "setSourceChannel(report.source_channel || '');",
  `setSourceChannel(report.source_channel || '');
            if (report.report_source_id) {
              setReportSourceId(report.report_source_id);
            }`
);

// 6. Fix Save logic
code = code.replace(
  "source_channel: finalChannel,",
  "source_channel: finalChannel,\n      report_source_id: reportSourceId || undefined,"
);

// 7. Update UI for the Source dropdown
const oldDropdown = `<select value={sourceChannel} onChange={e => setSourceChannel(e.target.value)} disabled={isEdit} className="w-full rounded-lg border-slate-300 p-2 border focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100">
                              {CHANNELS.map(s => <option key={s} value={s}>{s}</option>)}
                              <option value="Khác">Khác...</option>
                          </select>
                          {sourceChannel === 'Khác' && (
                              <input type="text" placeholder="Nhập nguồn khác" value={customChannel} onChange={e => setCustomChannel(e.target.value)} disabled={isEdit} className="mt-2 w-full rounded-lg border-slate-300 p-2 border focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                          )}`;

const newDropdown = `<select 
                            value={reportSourceId || sourceChannel} 
                            onChange={e => {
                              const val = e.target.value;
                              if (val === 'Khác') {
                                setReportSourceId('');
                                setSourceChannel('Khác');
                              } else {
                                const src = reportSources.find(s => s.id === val);
                                if (src) {
                                  setReportSourceId(src.id);
                                  setSourceChannel(src.name);
                                } else {
                                  // For legacy edit modes
                                  setReportSourceId('');
                                  setSourceChannel(val);
                                }
                              }
                            }} 
                            disabled={isEdit} 
                            className="w-full rounded-lg border-slate-300 p-2 border focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100"
                          >
                              {reportSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              {isEdit && sourceChannel && !reportSources.find(s => s.id === reportSourceId || s.name === sourceChannel) && (
                                <option value={sourceChannel}>{sourceChannel} (Cũ)</option>
                              )}
                              <option value="Khác">Khác...</option>
                          </select>
                          {sourceChannel === 'Khác' && (
                              <input type="text" placeholder="Nhập nguồn khác" value={customChannel} onChange={e => setCustomChannel(e.target.value)} disabled={isEdit} className="mt-2 w-full rounded-lg border-slate-300 p-2 border focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                          )}`;

code = code.replace(oldDropdown, newDropdown);

// 8. Dynamic Ratios
// Remove the existing `ratios` state usage or effect
code = code.replace(/const \[ratios, setRatios\] = useState<Record<string, string>>\(\{\}\);/g, '');

const ratioCalcRegex = /useEffect\(\(\) => \{[\s\S]*?setRatios\(\{[\s\S]*?\}\);\n  \}, \[valuesMap\]\);/g;
code = code.replace(ratioCalcRegex, '');

// We will dynamically calculate ratios at render time.
const calculateRatiosBlock = `
  // Dynamic Ratios calculation
  const getRatio = (numCode: string, denCode: string, label: string) => {
    const numDef = metricDefs.find(d => d.code === numCode);
    const denDef = metricDefs.find(d => d.code === denCode);
    
    // Only show if BOTH metrics are active in the current form
    if (!numDef || !denDef) return null;
    
    const numVal = valuesMap[numDef.id] || 0;
    const denVal = valuesMap[denDef.id] || 0;
    
    if (denVal === 0) return { label, value: '0%' };
    return { label, value: ((numVal / denVal) * 100).toFixed(2) + '%' };
  };

  const calculatedRatios = [
    getRatio('CUOC_GOI_NGHE_MAY', 'SO_CUOC_GOI', 'Tỷ lệ nghe máy'),
    getRatio('KHACH_DA_DEN', 'KHACH_HEN', 'Tỷ lệ đến trường'),
    getRatio('HO_SO_DANG_KY', 'TONG_LEAD', 'Tỷ lệ hồ sơ/lead'),
    getRatio('DONG_HOC_PHI', 'HO_SO_DANG_KY', 'Tỷ lệ đóng HP/hồ sơ'),
    getRatio('DONG_HOC_PHI', 'TONG_LEAD', 'Tỷ lệ chuyển đổi cuối'),
  ].filter(Boolean) as { label: string, value: string }[];
`;

// Insert the calculation right before the return statement
code = code.replace(/return \(\s*<div className="mx-auto max-w-4xl space-y-6 pb-20">/, calculateRatiosBlock + '\n  return (\n    <div className="mx-auto max-w-4xl space-y-6 pb-20">');

// Update UI to use calculatedRatios
const oldRatioCard = `<div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-xs">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Tỷ lệ tự động tính</h2>
                  <div className="space-y-2">
                      {Object.entries(ratios).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-sm">
                              <span className="text-slate-600">{key}</span>
                              <span className="font-semibold text-slate-900">{val}</span>
                          </div>
                      ))}
                  </div>
              </div>`;

const newRatioCard = `{calculatedRatios.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-xs">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Tỷ lệ tự động tính</h2>
                  <div className="space-y-2">
                      {calculatedRatios.map((ratio) => (
                          <div key={ratio.label} className="flex justify-between text-sm">
                              <span className="text-slate-600">{ratio.label}</span>
                              <span className="font-semibold text-slate-900">{ratio.value}</span>
                          </div>
                      ))}
                  </div>
              </div>
              )}`;

code = code.replace(oldRatioCard, newRatioCard);

fs.writeFileSync(file, code);
