import fs from 'fs';
import path from 'path';
import { 
  extractAvailableMetrics, 
  adaptMetricTrendData, 
  adaptKpiPeriodData 
} from './src/components/dashboard/staffChartAdapters';

async function runB32SelfTest() {
  console.log('Running v0.7-B3.2 Self-Test: Staff Metric and KPI Charts...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // 1. File existence checks
  const viewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'StaffDashboardView.tsx');
  const adapterPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'staffChartAdapters.ts');
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-b3-2-staff-metric-kpi-charts.md');

  assert(fs.existsSync(viewPath), 'StaffDashboardView.tsx exists');
  assert(fs.existsSync(adapterPath), 'staffChartAdapters.ts exists');
  assert(fs.existsSync(docPath), 'v0.7-b3-2-staff-metric-kpi-charts.md exists');

  const viewContent = fs.readFileSync(viewPath, 'utf-8');

  // 2. Metric Trend Chart Requirements
  assert(viewContent.includes('Xu hướng chỉ số công việc'), 'Metric trend chart section title present');
  assert(viewContent.includes('metric-selector'), 'Metric selector ID defined for accessibility');
  assert(viewContent.includes('LineChart'), 'Recharts LineChart used for metric trends');
  assert(viewContent.includes('availableMetrics.length > 1'), 'Selector rendered only when multiple metrics exist');
  assert(viewContent.includes('availableMetrics.length === 1'), 'Single metric displayed cleanly without unnecessary dropdown');
  assert(viewContent.includes('unit'), 'Metric unit preserved and displayed');
  assert(!viewContent.includes('<Line onClick') && !viewContent.includes('<Bar onClick'), 'Points and bars are non-clickable in B3.2');

  // 3. KPI Period Chart Requirements
  assert(viewContent.includes('Kết quả KPI theo kỳ'), 'KPI period chart section title present');
  assert(viewContent.includes('BarChart'), 'Recharts BarChart used for discrete KPI periods');
  assert(viewContent.includes('Chính thức'), 'Official snapshot label "Chính thức" present');
  assert(viewContent.includes('Tạm tính'), 'Live calculation label "Tạm tính" present');
  assert(!viewContent.includes('ReferenceLine') || !viewContent.includes('y={100}'), 'No invented 100% target line');

  // 4. Adapter Unit Tests
  // 4a. extractAvailableMetrics
  const mockDashboardData = {
    summary: {
      metrics: {
        definitions: [
          { metric_id: 'm-1', metric_name: 'Giờ giảng dạy', unit: 'giờ', aggregation_method: 'sum' },
          { metric_id: 'm-2', metric_name: 'Tỷ lệ chuyên cần', unit: '%', aggregation_method: 'avg' }
        ]
      }
    },
    series: {
      metrics: [
        { date: '2026-03-05', metric_id: 'm-1', value: 4 },
        { date: '2026-03-01', metric_id: 'm-1', value: 2 },
        { date: '2026-03-03', metric_id: 'm-1', value: null }
      ],
      kpis: [
        {
          period_id: 'p-2',
          period_name: 'Học kỳ II',
          start_date: '2026-02-01',
          end_date: '2026-06-30',
          average_score: 92.5,
          assignment_count: 5,
          achieved_count: 5,
          source: 'live'
        },
        {
          period_id: 'p-1',
          period_name: 'Học kỳ I',
          start_date: '2025-09-01',
          end_date: '2026-01-31',
          average_score: 88.0,
          assignment_count: 5,
          achieved_count: 4,
          source: 'official'
        }
      ]
    }
  };

  const extractedMetrics = extractAvailableMetrics(mockDashboardData);
  assert(extractedMetrics.length === 2, 'extractAvailableMetrics extracts definitions accurately');
  assert(extractedMetrics[0].metric_name === 'Giờ giảng dạy', 'extractAvailableMetrics preserves name');
  assert(extractedMetrics[0].unit === 'giờ', 'extractAvailableMetrics preserves unit');

  // 4b. adaptMetricTrendData
  const metricTrend = adaptMetricTrendData(mockDashboardData.series.metrics, 'm-1', extractedMetrics[0]);
  assert(metricTrend.points.length === 3, 'adaptMetricTrendData filters points by selected metric');
  assert(metricTrend.points[0].date === '2026-03-01', 'adaptMetricTrendData sorts points chronologically');
  assert(metricTrend.points[0].displayDate === '01/03/2026', 'adaptMetricTrendData formats display date');
  assert(metricTrend.points[1].value === null, 'adaptMetricTrendData preserves null distinctly from zero');
  assert(metricTrend.unit === 'giờ', 'adaptMetricTrendData returns metric unit');

  // 4c. adaptKpiPeriodData
  const kpiPeriodData = adaptKpiPeriodData(mockDashboardData.series.kpis);
  assert(kpiPeriodData.length === 2, 'adaptKpiPeriodData preserves all periods');
  assert(kpiPeriodData[0].period_id === 'p-1', 'adaptKpiPeriodData sorts periods chronologically by start date');
  assert(kpiPeriodData[0].sourceLabel === 'Chính thức', 'Official KPI tagged with "Chính thức" label');
  assert(kpiPeriodData[1].sourceLabel === 'Tạm tính', 'Live KPI tagged with "Tạm tính" label');
  assert(kpiPeriodData[0].score === 88.0, 'Backend-calculated KPI score preserved without modification');

  // 5. Invariant and Regression Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const b32Migrations = migrations.filter(m => m.includes('v0.7-b3-2') || m.includes('v0.7_b3_2'));
  assert(b32Migrations.length === 0, 'No database migration added for v0.7-B3.2');

  const pages = fs.existsSync(path.join(process.cwd(), 'src', 'pages'))
    ? fs.readdirSync(path.join(process.cwd(), 'src', 'pages'))
    : [];
  assert(!pages.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('manager') || p.toLowerCase().includes('bgh')), 'No unauthorized admin/manager dashboards added');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-B3.2 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-B3.2 Self-Test completed successfully.');
    process.exit(0);
  }
}

runB32SelfTest();
