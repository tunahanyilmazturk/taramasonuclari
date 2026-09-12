import { PatientRecord, TestDefinition, ResultStatus } from '../types';
import { includesTr } from '../utils/lab';
import { storageService } from './storageService';

declare global {
  interface Window {
    ExcelJS: any;
  }
}

export const exportToExcel = async (records: PatientRecord[], tests: TestDefinition[]) => {
  if (!records.length) return;

  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = storageService.getOrgInfo().name;
  workbook.created = new Date();

  // --- STYLING CONSTANTS ---
  const borderStyle = { style: 'thin', color: { argb: 'CBD5E1' } }; // Slate 300
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } }; // Slate 800
  const headerFont = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFF' } };

  // --- SHEET 1: SUMMARY DASHBOARD ---
  const summarySheet = workbook.addWorksheet('Rapor Özeti', { properties: { tabColor: { argb: '3B82F6' } } }); // Blue 500
  
  // Calculate General Stats
  const totalPatients = records.length;
  let riskyPatients = 0;
  let cleanPatients = 0;
  
  records.forEach(r => {
      const hasRisk = Object.values(r.status).some(s => s === ResultStatus.HIGH || s === ResultStatus.LOW);
      if(hasRisk) riskyPatients++;
      else cleanPatients++;
  });

  const riskRate = ((riskyPatients / totalPatients) * 100).toFixed(1);

  // Title Style
  summarySheet.mergeCells('B2:E3');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = 'SAĞLIK TARAMASI GENEL RAPORU';
  titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } }; // Blue 600
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

  // Date Info
  summarySheet.mergeCells('B4:E4');
  const dateCell = summarySheet.getCell('B4');
  dateCell.value = `Rapor Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;
  dateCell.font = { italic: true, color: { argb: '64748B' }, size: 10 }; // Slate 500
  dateCell.alignment = { horizontal: 'center' };

  // General Stats Table
  const startRow = 6;
  
  const addStatRow = (sheet: any, rowNum: number, label: string, value: string | number, color: string, bgColor?: string) => {
      const labelCell = sheet.getCell(`B${rowNum}`);
      labelCell.value = label;
      labelCell.font = { bold: true, color: { argb: '334155' }, size: 11 }; // Slate 700
      labelCell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }; // Slate 50

      const valueCell = sheet.getCell(`C${rowNum}`);
      valueCell.value = value;
      valueCell.font = { bold: true, color: { argb: color }, size: 11 };
      valueCell.alignment = { horizontal: 'center' };
      valueCell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
      if(bgColor) valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  };

  addStatRow(summarySheet, startRow, 'Toplam Personel', totalPatients, '1E293B', 'FFFFFF'); 
  addStatRow(summarySheet, startRow + 1, 'Bulgu Saptanan', riskyPatients, 'DC2626', 'FEF2F2'); // Red text on Red 50
  addStatRow(summarySheet, startRow + 2, 'Normal Sonuç', cleanPatients, '16A34A', 'F0FDF4'); // Green text on Green 50
  addStatRow(summarySheet, startRow + 3, 'Risk Oranı', `%${riskRate}`, 'EA580C', 'FFF7ED'); // Orange text on Orange 50

  summarySheet.getColumn('A').width = 2;
  summarySheet.getColumn('B').width = 25;
  summarySheet.getColumn('C').width = 20;

  // --- SHEET 2: DEPARTMENT ANALYSIS (NEW) ---
  const deptSheet = workbook.addWorksheet('Bölüm Analizi', { properties: { tabColor: { argb: 'F59E0B' } } });
  
  // Calculate Department Stats
  const deptStats: Record<string, { total: number, risks: number, issues: Record<string, number> }> = {};
  
  records.forEach(r => {
      const job = r.jobTitle || 'Belirtilmemiş';
      if(!deptStats[job]) deptStats[job] = { total: 0, risks: 0, issues: {} };
      
      deptStats[job].total++;
      let hasIssue = false;
      
      Object.entries(r.status).forEach(([testId, status]) => {
          if (status === ResultStatus.HIGH || status === ResultStatus.LOW) {
              hasIssue = true;
              // Find test name
              const testDef = tests.find(t => t.id === testId) || tests.find(t => t.subTests?.some(sub => sub.id === testId));
              const subDef = testDef?.subTests?.find(s => s.id === testId);
              const testName = subDef ? subDef.name : (testDef?.name || testId);
              
              deptStats[job].issues[testName] = (deptStats[job].issues[testName] || 0) + 1;
          }
      });
      if(hasIssue) deptStats[job].risks++;
  });

  // Dept Sheet Headers
  deptSheet.columns = [
      { header: 'Bölüm / Görev', key: 'job', width: 30 },
      { header: 'Personel Sayısı', key: 'total', width: 15 },
      { header: 'Riskli Personel', key: 'risky', width: 15 },
      { header: 'Risk Oranı (%)', key: 'rate', width: 15 },
      { header: 'En Sık Görülen Bulgular', key: 'topIssues', width: 50 },
  ];

  const deptHeaderRow = deptSheet.getRow(1);
  deptHeaderRow.height = 30;
  deptHeaderRow.eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  Object.entries(deptStats).forEach(([job, stats]) => {
      const rate = ((stats.risks / stats.total) * 100).toFixed(1);
      const topIssues = Object.entries(stats.issues)
          .sort((a,b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => `${name} (${count})`)
          .join(', ');

      const row = deptSheet.addRow({
          job: job,
          total: stats.total,
          risky: stats.risks,
          rate: `${rate}%`,
          topIssues: topIssues || 'Temiz'
      });

      row.getCell('rate').font = { bold: true, color: { argb: parseFloat(rate) > 20 ? 'DC2626' : '16A34A' } };
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('job').alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell('topIssues').alignment = { vertical: 'middle', horizontal: 'left' };
  });


  // --- SHEET 3: DETAILED DATA ---
  const worksheet = workbook.addWorksheet('Detaylı Liste', { properties: { tabColor: { argb: '10B981' } } });
  
  worksheet.views = [
    { state: 'frozen', xSplit: 4, ySplit: 1 }
  ];

  const excelColumns: { 
      id: string; 
      name: string; 
      unit: string; 
      key: string; 
      isPanel: boolean;
      subTests?: TestDefinition[];
  }[] = [];

  tests.forEach(test => {
    if (test.subTests && test.subTests.length > 0) {
      excelColumns.push({ 
          id: test.id, 
          name: test.name, 
          unit: 'Özet', 
          key: test.key, 
          isPanel: true,
          subTests: test.subTests 
      });
    } else {
      excelColumns.push({ 
          id: test.id, 
          name: test.name, 
          unit: test.unit, 
          key: test.key, 
          isPanel: false 
      });
    }
  });

  // Define Worksheet Columns
  worksheet.columns = [
    { header: '#', key: 'index', width: 5 },
    { header: 'Sicil No', key: 'registrationNumber', width: 15 },
    { header: 'Adı Soyadı', key: 'patientName', width: 30 },
    { header: 'Görevi', key: 'jobTitle', width: 20 }, // Added Job Title
    { header: 'Tarih', key: 'date', width: 12 },
    ...excelColumns.map(col => ({
      header: col.isPanel ? col.name : `${col.name}\n[${col.unit}]`,
      key: col.id,
      width: col.key.includes('goz') ? 40 : (col.key.includes('doctor') ? 50 : (col.isPanel ? 35 : 15))
    })),
    { header: 'Hekim Kanaati', key: 'doctorNotes', width: 50 }
  ];

  // ADD DATA ROWS
  records.forEach((record, idx) => {
    const rowData: Record<string, string | number> = {
      index: idx + 1,
      patientName: record.patientName,
      jobTitle: record.jobTitle || '-',
      date: record.date,
      registrationNumber: record.registrationNumber || '-',
      doctorNotes: record.doctorNotes || '-'
    };

    excelColumns.forEach(col => {
      // PANEL LOGIC (Hemogram, Urine)
      if (col.isPanel && col.subTests) {
          const abnormalFindings: string[] = [];
          col.subTests.forEach(sub => {
              const res = record.results[sub.id];
              const status = record.status[sub.id];
              const valStr = res?.value != null ? String(res.value) : '';

              if (status === ResultStatus.HIGH) {
                  abnormalFindings.push(`${sub.name}: ${res.value} ↑`);
              } else if (status === ResultStatus.LOW) {
                  abnormalFindings.push(`${sub.name}: ${res.value} ↓`);
              }
              else if (
                  (includesTr(valStr, 'pozitif') || valStr.includes('+++') || valStr.includes('++'))
                  && !includesTr(valStr, 'negatif')
              ) {
                  abnormalFindings.push(`${sub.name}: ${res.value}`);
              }
          });

          if (abnormalFindings.length > 0) {
              rowData[col.id] = abnormalFindings.join('\n');
          } else {
              rowData[col.id] = "Normal";
          }
      } 
      // SINGLE TEST LOGIC
      else {
          const res = record.results[col.id];
          if (res) {
            const val = typeof res.value === 'string' && !isNaN(parseFloat(res.value)) && res.value.trim() !== '' 
              ? parseFloat(res.value) 
              : res.value;
            rowData[col.id] = val;
          } else {
            rowData[col.id] = '-';
          }
      }
    });

    const row = worksheet.addRow(rowData);
    row.height = 25; // Default height

    // Adjust height if there is text wrapping
    if (record.doctorNotes && record.doctorNotes.length > 50) row.height = 45;
    
    // Zebra Striping
    if (idx % 2 === 1) {
       row.eachCell({ includeEmpty: true }, (cell: any) => {
           cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAFAFA' } }; // Very light gray
       });
    }

    // --- CELL STYLING ---
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
        cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        
        // Metadata Columns (Left aligned names)
        if (colNumber === 3 || colNumber === 4 || colNumber === worksheet.columnCount) { // Patient Name, Job, Notes
             cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
    });

    // --- CONDITIONAL FORMATTING ---
    // Start iterating from test columns (index 6 - because added Job Title)
    excelColumns.forEach((col, index) => {
        const cellIndex = index + 6; 
        const cell = row.getCell(cellIndex);
        
        // --- PANEL FORMATTING ---
        if (col.isPanel) {
            const cellValue = cell.value?.toString() || '';
            if (cellValue === 'Normal') {
                cell.font = { color: { argb: '16A34A' }, bold: true }; // Green 600
            } else if (cellValue !== '' && cellValue !== '-') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF2F2' } }; // Red 50
                cell.font = { color: { argb: 'B91C1C' }, bold: true }; // Red 700
                // Increase row height for multiple lines
                const lines = cellValue.split('\n').length;
                if (lines > 1) row.height = Math.max(row.height, lines * 15);
            }
            return;
        }

        // --- SINGLE TEST FORMATTING ---
        const status = record.status[col.id];
        const rawResValue = record.results[col.id]?.value;
        const resValue = rawResValue != null ? String(rawResValue) : "";

        const cellText = rowData[col.id];
        if (typeof cellText === 'string' && cellText.includes('|')) {
            cell.value = cellText.replace(/\s*\|\s*/g, '\n');
            row.height = 45;
        }

        // General Status Coloring
        if (status === ResultStatus.HIGH) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF2F2' } }; // Red 50
            cell.font = { color: { argb: 'DC2626' }, bold: true }; // Red 600
        } else if (status === ResultStatus.LOW) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7ED' } }; // Orange 50
            cell.font = { color: { argb: 'C2410C' }, bold: true }; // Orange 700
        }

        // Specific Text Logic Overrides
        if (col.key.includes('tetanoz') && (includesTr(resValue, 'yap') || includesTr(resValue, 'var'))) {
             cell.font = { color: { argb: '16A34A' }, bold: true };
        }
        else if (col.key.includes('kan_grubu')) {
             cell.font = { color: { argb: '2563EB' }, bold: true };
        }
        else if ((col.key.includes('hbsag') || col.key.includes('hcv') || col.key.includes('hiv')) && includesTr(resValue, 'pozitif')) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }; // Red 100
             cell.font = { color: { argb: '991B1B' }, bold: true }; // Red 800
        }
    });
  });

  // HEADER ROW STYLING
  const headerRow = worksheet.getRow(1);
  headerRow.height = 40;
  headerRow.eachCell((cell: any) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
  });

  // Filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount }
  };

  // EXPORT
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `HanTech_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};