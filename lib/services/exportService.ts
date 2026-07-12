import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';
const pdfmake = require('pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
for (const [key, value] of Object.entries(pdfFonts)) {
  pdfmake.virtualfs.storage[key] = Buffer.from(value as string, 'base64');
}
import { getStudentAcademicSummary } from './academicScoreService';
import { calculateAndGetSemesterSummary } from './characterSummaryService';

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

function ensureReportsDirectory() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

const fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  }
};

pdfmake.setFonts(fonts);

export async function exportStudentReport(
  studentId: string,
  academicYearId: string,
  semesterId: string,
  reportType: 'academic' | 'character' | 'full',
  actorId: string
) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('student_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  ensureReportsDirectory();

  try {
    const student = await db('students').where('id', studentId).first();
    if (!student) {
      throw new AppError('Student not found.', 'ERR_VALIDATION', 404);
    }

    const year = await db('academic_years').where('id', academicYearId).first();
    const sem = await db('semesters').where('id', semesterId).first();
    if (!year || !sem) {
      throw new AppError('Academic period not found.', 'ERR_VALIDATION', 404);
    }

    const enrollment = await db('student_enrollments')
      .join('classes', 'student_enrollments.class_id', 'classes.id')
      .where({
        'student_enrollments.student_id': studentId,
        'student_enrollments.academic_year_id': academicYearId,
        'student_enrollments.semester_id': semesterId,
        'student_enrollments.status': 'active'
      })
      .select('student_enrollments.class_id', 'classes.name as class_name')
      .first();

    const className = enrollment ? enrollment.class_name : 'N/A';

    // 1. Gather report data
    let docContent: any[] = [
      { text: `RAPOR HASIL BELAJAR SISWA (${reportType.toUpperCase()})`, style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
      {
        columns: [
          { text: `Nama Siswa: ${student.full_name}\nNISN: ${student.nisn}\nKelas: ${className}`, style: 'subheader' },
          { text: `Tahun Ajaran: ${year.name}\nSemester: ${sem.name}\nTanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, style: 'subheader', alignment: 'right' }
        ],
        margin: [0, 0, 0, 20]
      }
    ];

    if (reportType === 'academic' || reportType === 'full') {
      const academicData = await getStudentAcademicSummary(studentId, academicYearId, semesterId);
      
      const tableBody = [
        [
          { text: 'No', style: 'tableHeader' },
          { text: 'Mata Pelajaran', style: 'tableHeader' },
          { text: 'KKM', style: 'tableHeader' },
          { text: 'Nilai Rata-rata', style: 'tableHeader' }
        ]
      ];

      academicData.forEach((row: any, idx: number) => {
        tableBody.push([
          { text: (idx + 1).toString(), style: 'tableCell' },
          { text: row.subject_name, style: 'tableCell' },
          { text: row.kkm?.toString() || '75', style: 'tableCell' },
          { text: row.average_score.toString(), style: 'tableCell' }
        ]);
      });

      docContent.push(
        { text: 'A. CAPAIAN AKADEMIK', style: 'sectionHeader', margin: [0, 10, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: [30, '*', 50, 80],
            body: tableBody
          },
          margin: [0, 0, 0, 20]
        }
      );
    }

    if (reportType === 'character' || reportType === 'full') {
      let charData: any = {};
      try {
        charData = await calculateAndGetSemesterSummary(studentId, academicYearId, semesterId, false);
      } catch (e) {
        // use fallback empty structure
      }

      const tableBody = [
        [
          { text: 'Nilai Karakter FITRAH', style: 'tableHeader' },
          { text: 'Skor Akhir', style: 'tableHeader' }
        ],
        [{ text: 'Fathonah (F)', style: 'tableCell' }, { text: charData?.f_score || '0.00', style: 'tableCell' }],
        [{ text: 'Istiqamah (I)', style: 'tableCell' }, { text: charData?.i_score || '0.00', style: 'tableCell' }],
        [{ text: 'Tanggung Jawab (T)', style: 'tableCell' }, { text: charData?.t_score || '0.00', style: 'tableCell' }],
        [{ text: 'Ramah (R)', style: 'tableCell' }, { text: charData?.r_score || '0.00', style: 'tableCell' }],
        [{ text: 'Amanah (A)', style: 'tableCell' }, { text: charData?.a_score || '0.00', style: 'tableCell' }],
        [{ text: 'Harmonis (H)', style: 'tableCell' }, { text: charData?.h_score || '0.00', style: 'tableCell' }]
      ];

      docContent.push(
        { text: 'B. EVALUASI BUDAYA & KARAKTER FITRAH', style: 'sectionHeader', margin: [0, 10, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 100],
            body: tableBody
          },
          margin: [0, 0, 0, 20]
        }
      );
    }

    // Tanda tangan
    docContent.push({
      columns: [
        { text: '\n\nMengetahui,\nOrang Tua/Wali\n\n\n\n___________________', alignment: 'left' },
        { text: `\n\nSidoarjo, ${new Date().toLocaleDateString('id-ID')}\nWali Kelas\n\n\n\n___________________`, alignment: 'right' }
      ]
    });

    const docDefinition = {
      content: docContent,
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10
      },
      styles: {
        header: {
          fontSize: 16,
          bold: true
        },
        subheader: {
          fontSize: 9,
          color: '#555555'
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          color: '#2A3F54'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'black',
          fillColor: '#EEEEEE'
        },
        tableCell: {
          fontSize: 9
        }
      }
    };

    const id = uuidv4();
    const fileName = `${student.full_name.replace(/\s+/g, '_')}_${reportType}_report.pdf`;
    const filePath = path.join(REPORTS_DIR, `${id}-${fileName}`);

    // Generate PDF and write to file
    const pdfDoc = pdfmake.createPdf(docDefinition);
    await pdfDoc.write(filePath);

    const stats = fs.statSync(filePath);

    // Save to report_exports
    await db('report_exports').insert({
      id,
      report_type: reportType,
      student_id: studentId,
      class_id: enrollment ? enrollment.class_id : null,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      generated_by: actorId,
      generated_at: new Date(),
      status: 'completed',
      file_path: filePath,
      file_name: fileName,
      mime_type: 'application/pdf',
      file_size: stats.size,
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    return {
      export_id: id,
      file_name: fileName
    };

  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Error generating report PDF',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}

export async function getExportLogDetail(id: string) {
  const log = await db('report_exports').where('id', id).first();
  if (!log) {
    throw new AppError('Export log not found.', 'ERR_VALIDATION', 404);
  }
  return log;
}
