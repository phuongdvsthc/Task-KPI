const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const oldLogic = `
    await supabase.from('kpi_definitions').insert([
      { id: def1Id, name: 'Dash Metric 1', code: 'DM1', unit: 'vnd', data_type: 'number', calculation_type: 'sum', is_active: true },
      { id: def2Id, name: 'Dash Metric 2', code: 'DM2', unit: 'vnd', data_type: 'number', calculation_type: 'sum', is_active: true }
    ]);
`;

const newLogic = `
    const err_defs = (await supabase.from('kpi_definitions').insert([
      { id: def1Id, name: 'Dash Metric 1', code: 'DM1', unit_code: 'vnd', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true },
      { id: def2Id, name: 'Dash Metric 2', code: 'DM2', unit_code: 'vnd', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true }
    ])).error; if (err_defs) throw new Error("Defs insert failed: " + JSON.stringify(err_defs));
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('test_v0.4.6-A.cjs', content);
