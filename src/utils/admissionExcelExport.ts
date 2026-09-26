import ExcelJS from 'exceljs';
import { 
  AdmissionDashboardData, 
  AdmissionDashboardFilters, 
  CampaignProgressRow, 
  ProgramItemRow 
} from '../services/admissionDashboardService';

// Styling helper constants
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' }, // Slate-800
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const SUBHEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF1F5F9' }, // Slate-100
};

const TOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' }, // Slate-200
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function formatFilterTimeRange(tr?: string): string {
  switch (tr) {
    case 'week': return '7 ngày qua (Tuần)';
    case 'month': return '30 ngày qua (Tháng)';
    case 'quarter': return '90 ngày qua (Quý)';
    default: return 'Tất cả thời gian';
  }
}

function formatResultStatus(status: string | null): string {
  if (status === 'finalized') return 'Đã chốt';
  if (status === 'draft') return 'Nháp';
  return 'Chưa có kết quả';
}

function formatDataSource(source: string | null): string {
  if (source === 'google_sheets') return 'Google Sheets';
  if (source === 'manual') return 'Nhập thủ công';
  return 'Chưa cập nhật';
}

/**
 * Downloads a workbook as an .xlsx file in the browser
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export interface ExportContextInfo {
  year: number;
  groupName?: string;
  campaignName?: string;
  assigneeName?: string;
}

/**
 * Export Entire Recruitment Overview Dashboard to Excel (Multiple Sheets)
 */
export async function exportAdmissionDashboardToExcel(
  data: AdmissionDashboardData,
  filters: AdmissionDashboardFilters,
  context?: ExportContextInfo
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống Quản lý Tuyển sinh';
  workbook.created = new Date();

  const exportDateStr = new Date().toLocaleString('vi-VN');

  // ==========================================
  // SHEET 1: TỔNG QUAN & KPI TUYỂN SINH
  // ==========================================
  const summarySheet = workbook.addWorksheet('Tổng quan & KPIs', {
    views: [{ showGridLines: true }]
  });

  // Title
  summarySheet.mergeCells('A1:G1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `BÁO CÁO TỔNG QUAN THỐNG KÊ TUYỂN SINH - NĂM ${filters.year}`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 35;

  // Metadata / Filters block
  summarySheet.getCell('A3').value = 'Thông tin bộ lọc & Xuất báo cáo:';
  summarySheet.getCell('A3').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF334155' } };

  const metaRows = [
    ['Năm tuyển sinh:', filters.year, 'Khoảng thời gian:', formatFilterTimeRange(filters.timeRange)],
    ['Nhóm chương trình:', context?.groupName || 'Tất cả các nhóm', 'Nhân sự phụ trách:', context?.assigneeName || 'Tất cả nhân sự'],
    ['Đợt tuyển sinh:', context?.campaignName || 'Tất cả các đợt', 'Chế độ dữ liệu:', filters.dataMode === 'finalized_only' ? 'Chỉ số liệu đã chốt' : 'Tất cả (Bao gồm nháp)'],
    ['Thời điểm xuất báo cáo:', exportDateStr, '', '']
  ];

  metaRows.forEach((rowVals) => {
    const row = summarySheet.addRow(rowVals);
    row.font = { name: 'Arial', size: 10 };
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
    row.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
  });

  summarySheet.addRow([]); // spacing

  // KPI Block Header
  const kpiHeaderRow = summarySheet.addRow(['CHỈ SỐ KPI TUYỂN SINH', 'GIÁ TRỊ', 'ĐƠN VỊ', 'GHI CHÚ']);
  kpiHeaderRow.height = 25;
  kpiHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  const kpi = data.kpis;
  const kpiItems = [
    ['Chỉ tiêu tuyển sinh năm', kpi.annualPlan, 'Chỉ tiêu', 'Tổng kế hoạch giao cho năm'],
    ['Đã phân bổ theo các đợt', kpi.allocatedPlan, 'Chỉ tiêu', 'Tổng chỉ tiêu các đợt đã lập kế hoạch'],
    ['Tổng số hồ sơ đăng ký', kpi.registeredCount, 'Hồ sơ', 'Số lượng ứng viên nộp hồ sơ'],
    ['Đã nhập học (Đóng học phí)', kpi.paidCount, 'Thí sinh', 'Số lượng hoàn tất thủ tục tài chính'],
    ['Tỷ lệ chuyển đổi (Đóng HP / Đăng ký)', (kpi.conversionRate / 100), '%', 'Tỷ lệ ứng viên nộp tiền / đăng ký'],
    ['Tỷ lệ hoàn thành chỉ tiêu năm', (kpi.fulfillmentRate / 100), '%', 'Đã đóng học phí / Chỉ tiêu năm'],
    ['Số lượng còn lại cần tuyển', kpi.remainingCount, 'Chỉ tiêu', kpi.isExcess ? 'Đã vượt chỉ tiêu đề ra' : 'Cần đạt thêm để đủ chỉ tiêu'],
    ['Số đợt đã chốt kết quả', `${kpi.finalizedCampaignsCount} / ${kpi.totalCampaignsWithResults}`, 'Đợt', 'Tiến độ nghiệm thu kết quả']
  ];

  kpiItems.forEach((item) => {
    const row = summarySheet.addRow(item);
    row.font = { name: 'Arial', size: 10 };
    row.getCell(1).border = BORDER_THIN;
    row.getCell(2).border = BORDER_THIN;
    row.getCell(3).border = BORDER_THIN;
    row.getCell(4).border = BORDER_THIN;

    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'center' };

    if (item[2] === '%') {
      row.getCell(2).numFmt = '0.0%';
    } else if (typeof item[1] === 'number') {
      row.getCell(2).numFmt = '#,##0';
    }
  });

  summarySheet.addRow([]); // spacing

  // Performance by group table if exists
  if (data.groupPerformance && data.groupPerformance.length > 0) {
    const groupSecHeader = summarySheet.addRow(['TIẾN ĐỘ THEO NHÓM CHƯƠNG TRÌNH']);
    groupSecHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };

    const grpHeaders = summarySheet.addRow(['STT', 'Mã nhóm', 'Tên nhóm chương trình', 'Chỉ tiêu năm', 'Đăng ký', 'Đã đóng HP', 'Tỷ lệ CĐ (%)', 'Tỷ lệ TH (%)']);
    grpHeaders.height = 24;
    grpHeaders.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_THIN;
    });

    data.groupPerformance.forEach((grp, idx) => {
      const row = summarySheet.addRow([
        idx + 1,
        grp.groupCode,
        grp.groupName,
        grp.annualPlan,
        grp.registeredCount,
        grp.paidCount,
        grp.conversionRate / 100,
        grp.fulfillmentRate / 100
      ]);
      row.font = { name: 'Arial', size: 10 };
      row.eachCell((cell, colNum) => {
        cell.border = BORDER_THIN;
        if (colNum === 1 || colNum === 2) cell.alignment = { horizontal: 'center' };
        if (colNum >= 4 && colNum <= 6) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
        if (colNum >= 7) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '0.0%';
        }
      });
    });
  }

  summarySheet.columns = [
    { width: 35 },
    { width: 20 },
    { width: 30 },
    { width: 35 },
    { width: 16 },
    { width: 16 },
    { width: 16 }
  ];

  // ==========================================
  // SHEET 2: CHI TIẾT THEO ĐỢT TUYỂN SINH
  // ==========================================
  const campaignSheet = workbook.addWorksheet('Chi tiết theo đợt', {
    views: [{ showGridLines: true }]
  });

  campaignSheet.mergeCells('A1:N1');
  const campTitleCell = campaignSheet.getCell('A1');
  campTitleCell.value = `CHI TIẾT KẾT QUẢ THEO ĐỢT TUYỂN SINH - NĂM ${filters.year}`;
  campTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  campTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  campaignSheet.getRow(1).height = 32;

  const campHeaders = [
    'STT',
    'Mã đợt',
    'Tên đợt tuyển sinh',
    'Nhóm chương trình',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Chỉ tiêu phân bổ',
    'Hồ sơ đăng ký',
    'Đã đóng HP (Nhập học)',
    'Tỷ lệ CĐ (%)',
    'Tỷ lệ TH (%)',
    'Trạng thái',
    'Nguồn dữ liệu',
    'Người cập nhật'
  ];

  const campHeaderRow = campaignSheet.addRow(campHeaders);
  campHeaderRow.height = 28;
  campHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER_THIN;
  });

  let totalAllocated = 0;
  let totalRegistered = 0;
  let totalPaid = 0;

  data.campaignProgress.forEach((cp, idx) => {
    totalAllocated += cp.allocatedPlan || 0;
    totalRegistered += cp.registeredCount || 0;
    totalPaid += cp.paidCount || 0;

    const startDateStr = cp.startDate ? new Date(cp.startDate).toLocaleDateString('vi-VN') : '—';
    const endDateStr = cp.endDate ? new Date(cp.endDate).toLocaleDateString('vi-VN') : '—';

    const row = campaignSheet.addRow([
      idx + 1,
      cp.campaignCode,
      cp.campaignName,
      cp.groupName,
      startDateStr,
      endDateStr,
      cp.allocatedPlan,
      cp.registeredCount,
      cp.paidCount,
      cp.conversionRate / 100,
      cp.fulfillmentRate / 100,
      formatResultStatus(cp.resultStatus),
      formatDataSource(cp.dataSource),
      cp.updatedBy || '—'
    ]);

    row.font = { name: 'Arial', size: 10 };
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_THIN;
      if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6 || colNum === 12 || colNum === 13) {
        cell.alignment = { horizontal: 'center' };
      }
      if (colNum >= 7 && colNum <= 9) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 10 || colNum === 11) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  });

  // Total row for campaigns
  if (data.campaignProgress.length > 0) {
    const avgConvRate = totalRegistered > 0 ? (totalPaid / totalRegistered) : 0;
    const avgFulfillRate = totalAllocated > 0 ? (totalPaid / totalAllocated) : 0;

    const totalRow = campaignSheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      '',
      totalAllocated,
      totalRegistered,
      totalPaid,
      avgConvRate,
      avgFulfillRate,
      '',
      '',
      ''
    ]);
    campaignSheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNum) => {
      cell.fill = TOTAL_FILL;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = BORDER_THIN;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum >= 7 && colNum <= 9) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 10 || colNum === 11) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  }

  campaignSheet.columns = [
    { width: 8 },   // STT
    { width: 15 },  // Mã đợt
    { width: 32 },  // Tên đợt
    { width: 22 },  // Nhóm
    { width: 14 },  // Ngày BĐ
    { width: 14 },  // Ngày KT
    { width: 18 },  // Phân bổ
    { width: 16 },  // Đăng ký
    { width: 18 },  // Đã đóng HP
    { width: 14 },  // Tỷ lệ CĐ
    { width: 14 },  // Tỷ lệ TH
    { width: 15 },  // Trạng thái
    { width: 18 },  // Nguồn
    { width: 24 }   // Người cập nhật
  ];

  // ==========================================
  // SHEET 3: CHI TIẾT THEO NGÀNH / LỚP
  // ==========================================
  const programSheet = workbook.addWorksheet('Theo ngành - lớp', {
    views: [{ showGridLines: true }]
  });

  programSheet.mergeCells('A1:G1');
  const progTitleCell = programSheet.getCell('A1');
  progTitleCell.value = `CHI TIẾT KẾT QUẢ TUYỂN SINH THEO NGÀNH / LỚP - NĂM ${filters.year}`;
  progTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  progTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  programSheet.getRow(1).height = 32;

  const progHeaders = [
    'STT',
    'Mã ngành',
    'Tên ngành / lớp tuyển sinh',
    'Nhóm chương trình',
    'Hồ sơ đăng ký',
    'Đã đóng học phí',
    'Tỷ lệ chuyển đổi (%)'
  ];

  const progHeaderRow = programSheet.addRow(progHeaders);
  progHeaderRow.height = 28;
  progHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  let totalProgRegistered = 0;
  let totalProgPaid = 0;

  data.programItems.forEach((prog, idx) => {
    totalProgRegistered += prog.registeredCount || 0;
    totalProgPaid += prog.paidCount || 0;
    const convRate = prog.registeredCount > 0 ? (prog.paidCount / prog.registeredCount) : 0;

    const row = programSheet.addRow([
      idx + 1,
      prog.programCode,
      prog.programName,
      prog.groupName,
      prog.registeredCount,
      prog.paidCount,
      convRate
    ]);

    row.font = { name: 'Arial', size: 10 };
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_THIN;
      if (colNum === 1 || colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 7) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  });

  // Total row for programs
  if (data.programItems.length > 0) {
    const totalProgConvRate = totalProgRegistered > 0 ? (totalProgPaid / totalProgRegistered) : 0;
    const progTotalRow = programSheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      totalProgRegistered,
      totalProgPaid,
      totalProgConvRate
    ]);
    programSheet.mergeCells(`A${progTotalRow.number}:D${progTotalRow.number}`);
    progTotalRow.height = 24;
    progTotalRow.eachCell((cell, colNum) => {
      cell.fill = TOTAL_FILL;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = BORDER_THIN;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 7) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  }

  programSheet.columns = [
    { width: 8 },   // STT
    { width: 16 },  // Mã ngành
    { width: 38 },  // Tên ngành
    { width: 24 },  // Nhóm
    { width: 18 },  // Đăng ký
    { width: 18 },  // Đã đóng HP
    { width: 22 }   // Tỷ lệ chuyển đổi
  ];

  const fileName = `Bao_cao_tuyen_sinh_${filters.year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
}

/**
 * Export Campaign Progress Table only to Excel
 */
export async function exportCampaignsTableToExcel(
  campaigns: CampaignProgressRow[],
  year: number,
  additionalTitle?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống Quản lý Tuyển sinh';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Kết quả theo đợt', {
    views: [{ showGridLines: true }]
  });

  sheet.mergeCells('A1:N1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = additionalTitle 
    ? `BÁO CÁO KẾT QUẢ THEO ĐỢT TUYỂN SINH - ${additionalTitle.toUpperCase()}`
    : `BÁO CÁO KẾT QUẢ THEO ĐỢT TUYỂN SINH - NĂM ${year}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 32;

  const headers = [
    'STT',
    'Mã đợt',
    'Tên đợt tuyển sinh',
    'Nhóm chương trình',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Chỉ tiêu phân bổ',
    'Hồ sơ đăng ký',
    'Đã đóng HP (Nhập học)',
    'Tỷ lệ CĐ (%)',
    'Tỷ lệ TH (%)',
    'Trạng thái',
    'Nguồn dữ liệu',
    'Người cập nhật'
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  let totalAllocated = 0;
  let totalRegistered = 0;
  let totalPaid = 0;

  campaigns.forEach((cp, idx) => {
    totalAllocated += cp.allocatedPlan || 0;
    totalRegistered += cp.registeredCount || 0;
    totalPaid += cp.paidCount || 0;

    const row = sheet.addRow([
      idx + 1,
      cp.campaignCode,
      cp.campaignName,
      cp.groupName,
      cp.startDate ? new Date(cp.startDate).toLocaleDateString('vi-VN') : '—',
      cp.endDate ? new Date(cp.endDate).toLocaleDateString('vi-VN') : '—',
      cp.allocatedPlan,
      cp.registeredCount,
      cp.paidCount,
      cp.conversionRate / 100,
      cp.fulfillmentRate / 100,
      formatResultStatus(cp.resultStatus),
      formatDataSource(cp.dataSource),
      cp.updatedBy || '—'
    ]);

    row.font = { name: 'Arial', size: 10 };
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_THIN;
      if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6 || colNum === 12 || colNum === 13) {
        cell.alignment = { horizontal: 'center' };
      }
      if (colNum >= 7 && colNum <= 9) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 10 || colNum === 11) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  });

  if (campaigns.length > 0) {
    const avgConv = totalRegistered > 0 ? (totalPaid / totalRegistered) : 0;
    const avgFulfill = totalAllocated > 0 ? (totalPaid / totalAllocated) : 0;

    const totalRow = sheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      '',
      totalAllocated,
      totalRegistered,
      totalPaid,
      avgConv,
      avgFulfill,
      '',
      '',
      ''
    ]);
    sheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNum) => {
      cell.fill = TOTAL_FILL;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = BORDER_THIN;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum >= 7 && colNum <= 9) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 10 || colNum === 11) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  }

  sheet.columns = [
    { width: 8 },
    { width: 15 },
    { width: 32 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 15 },
    { width: 18 },
    { width: 24 }
  ];

  const fileName = `Ket_qua_theo_dot_tuyen_sinh_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
}

/**
 * Export Programs / Majors Breakdown Table only to Excel
 */
export async function exportProgramsTableToExcel(
  programs: ProgramItemRow[],
  year: number,
  campaignName?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống Quản lý Tuyển sinh';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Kết quả theo ngành - lớp', {
    views: [{ showGridLines: true }]
  });

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = campaignName
    ? `BÁO CÁO CHI TIẾT THEO NGÀNH / LỚP - ĐỢT: ${campaignName.toUpperCase()}`
    : `BÁO CÁO CHI TIẾT KẾT QUẢ THEO NGÀNH / LỚP - NĂM ${year}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 32;

  const headers = [
    'STT',
    'Mã ngành',
    'Tên ngành / lớp tuyển sinh',
    'Nhóm chương trình',
    'Hồ sơ đăng ký',
    'Đã đóng học phí',
    'Tỷ lệ chuyển đổi (%)'
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  let totalRegistered = 0;
  let totalPaid = 0;

  programs.forEach((prog, idx) => {
    totalRegistered += prog.registeredCount || 0;
    totalPaid += prog.paidCount || 0;
    const convRate = prog.registeredCount > 0 ? (prog.paidCount / prog.registeredCount) : 0;

    const row = sheet.addRow([
      idx + 1,
      prog.programCode,
      prog.programName,
      prog.groupName,
      prog.registeredCount,
      prog.paidCount,
      convRate
    ]);

    row.font = { name: 'Arial', size: 10 };
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_THIN;
      if (colNum === 1 || colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 7) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  });

  if (programs.length > 0) {
    const totalConvRate = totalRegistered > 0 ? (totalPaid / totalRegistered) : 0;
    const totalRow = sheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      totalRegistered,
      totalPaid,
      totalConvRate
    ]);
    sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNum) => {
      cell.fill = TOTAL_FILL;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = BORDER_THIN;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNum === 7) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  }

  sheet.columns = [
    { width: 8 },
    { width: 16 },
    { width: 38 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 22 }
  ];

  const fileName = campaignName
    ? `Ket_qua_nganh_lop_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    : `Ket_qua_nganh_lop_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
}

/**
 * Export specific single Campaign Result (from ResultEntryView) to Excel
 */
export async function exportCampaignResultDetailToExcel(
  campaignData: any, // CampaignResultData
  additionalInfo?: { groupName?: string; year?: number }
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống Quản lý Tuyển sinh';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Báo cáo đợt tuyển sinh', {
    views: [{ showGridLines: true }]
  });

  const campaign = campaignData.campaign;
  const result = campaignData.result;
  const plan = campaignData.plan;

  // Title
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `BÁO CÁO KẾT QUẢ ĐỢT: ${campaign.name.toUpperCase()} (${campaign.code})`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 32;

  // Metadata block
  sheet.getCell('A3').value = 'Thông tin đợt tuyển sinh:';
  sheet.getCell('A3').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF334155' } };

  const metaRows = [
    ['Mã đợt:', campaign.code, 'Nhóm chương trình:', additionalInfo?.groupName || '—'],
    ['Tên đợt:', campaign.name, 'Năm tuyển sinh:', additionalInfo?.year || '—'],
    ['Thời gian:', `${campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('vi-VN') : ''} - ${campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('vi-VN') : ''}`, 'Trạng thái đợt:', formatResultStatus(result?.status || null)],
    ['Hình thức nhập liệu:', result?.entry_mode === 'manual_total' ? 'Nhập tổng hợp' : 'Tổng từ chi tiết ngành/lớp', 'Thời điểm xuất:', new Date().toLocaleString('vi-VN')]
  ];

  metaRows.forEach(rowVals => {
    const r = sheet.addRow(rowVals);
    r.font = { name: 'Arial', size: 10 };
    r.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
    r.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
  });

  sheet.addRow([]); // spacing

  // Summary Metrics Header
  const sumHeader = sheet.addRow(['CHỈ SỐ TỔNG HỢP CỦA ĐỢT', 'GIÁ TRỊ', 'ĐƠN VỊ', 'ĐÁNH GIÁ']);
  sumHeader.height = 25;
  sumHeader.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  const allocated = plan?.allocated_target || 0;
  const registered = result?.registered_count || 0;
  const paid = result?.paid_count || 0;
  const unpaid = registered - paid;
  const convRate = registered > 0 ? (paid / registered) : 0;
  const fulfillRate = allocated > 0 ? (paid / allocated) : 0;

  const summaryItems = [
    ['Chỉ tiêu phân bổ cho đợt', allocated, 'Chỉ tiêu', 'Kế hoạch được giao'],
    ['Tổng hồ sơ đăng ký', registered, 'Hồ sơ', 'Số ứng viên đăng ký'],
    ['Đã nhập học (Đóng học phí)', paid, 'Thí sinh', 'Hoàn tất học phí'],
    ['Chưa hoàn tất thủ tục / đóng phí', unpaid, 'Thí sinh', 'Cần chăm sóc, chuyển đổi tiếp'],
    ['Tỷ lệ chuyển đổi (Đóng HP / ĐK)', convRate, '%', 'Hiệu quả tư vấn'],
    ['Tỷ lệ hoàn thành chỉ tiêu đợt', fulfillRate, '%', 'Tiến độ so với phân bổ đợt']
  ];

  summaryItems.forEach(item => {
    const row = sheet.addRow(item);
    row.font = { name: 'Arial', size: 10 };
    row.getCell(1).border = BORDER_THIN;
    row.getCell(2).border = BORDER_THIN;
    row.getCell(3).border = BORDER_THIN;
    row.getCell(4).border = BORDER_THIN;
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'center' };

    if (item[2] === '%') {
      row.getCell(2).numFmt = '0.0%';
    } else {
      row.getCell(2).numFmt = '#,##0';
    }
  });

  sheet.addRow([]); // spacing

  // Items table (if detail_sum or items exist)
  if (campaignData.items && campaignData.items.length > 0) {
    const progSec = sheet.addRow(['CHI TIẾT KẾT QUẢ THEO NGÀNH / LỚP']);
    progSec.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };

    const detailHeaders = [
      'STT',
      'Mã ngành',
      'Tên ngành / lớp đào tạo',
      'Hồ sơ đăng ký',
      'Đã đóng học phí',
      'Tỷ lệ chuyển đổi (%)',
      'Ghi chú lý do chưa chuyển đổi'
    ];

    const dHeaderRow = sheet.addRow(detailHeaders);
    dHeaderRow.height = 25;
    dHeaderRow.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      c.font = HEADER_FONT;
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = BORDER_THIN;
    });

    const progMap = new Map<string, any>();
    if (campaignData.activePrograms) {
      campaignData.activePrograms.forEach((p: any) => progMap.set(p.id, p));
    }

    campaignData.items.forEach((it: any, idx: number) => {
      const p = progMap.get(it.program_id);
      const itReg = it.registered_count || 0;
      const itPaid = it.paid_count || 0;
      const itConv = itReg > 0 ? (itPaid / itReg) : 0;

      const row = sheet.addRow([
        idx + 1,
        p?.code || '—',
        p?.name || 'Ngành không xác định',
        itReg,
        itPaid,
        itConv,
        it.not_converted_note || ''
      ]);

      row.font = { name: 'Arial', size: 10 };
      row.eachCell((cell, colNum) => {
        cell.border = BORDER_THIN;
        if (colNum === 1 || colNum === 2) cell.alignment = { horizontal: 'center' };
        if (colNum === 4 || colNum === 5) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
        if (colNum === 6) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '0.0%';
        }
      });
    });
  }

  sheet.columns = [
    { width: 8 },
    { width: 16 },
    { width: 38 },
    { width: 18 },
    { width: 18 },
    { width: 22 },
    { width: 30 }
  ];

  const fileName = `Ket_qua_dot_${campaign.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
}

