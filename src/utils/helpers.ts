import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { RequestItem } from '../types';

export const TODAY = () => new Date().toISOString().slice(0, 10);

export const money = (n: number) => `${Number(n || 0).toLocaleString()} ريال`;

export const escapeHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const exportExcel = async (rows: RequestItem[], title: string) => {
  try {
    const csv = '\ufeff' + [
      'رقم العملية,التاريخ,السيارة,السائق,النوع,الكمية,التكلفة,الحالة,الملاحظات',
      ...rows.map(r => [r.id, r.date, r.vehicleId, r.driver, r.type, r.qty, r.total, r.status, r.notes || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const uri = `${FileSystem.cacheDirectory}${title}_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'تصدير التقرير إلى Excel' });
    } else {
      Alert.alert('تم الإنشاء', 'تم إنشاء ملف CSV متوافق مع Excel داخل ذاكرة التطبيق.');
    }
  } catch {
    Alert.alert('خطأ', 'تعذر تصدير ملف Excel.');
  }
};

export const exportPdf = async (rows: RequestItem[], title: string) => {
  try {
    const body = rows.map(r =>
      `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.vehicleId)}</td><td>${escapeHtml(r.type)}</td><td>${r.qty}</td><td>${money(r.total)}</td></tr>`
    ).join('');

    const html = `<html dir="rtl"><head><meta charset="utf-8"><style>
      body{font-family:Arial;padding:24px}h1{text-align:center}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:center}
    </style></head><body><h1>${escapeHtml(title)}</h1>
    <p>الإجمالي: ${money(rows.reduce((s,r)=>s+r.total,0))}</p>
    <table><tr><th>العملية</th><th>التاريخ</th><th>السيارة</th><th>النوع</th><th>الكمية</th><th>التكلفة</th></tr>${body}</table>
    </body></html>`;

    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'تصدير التقرير PDF' });
    } else {
      Alert.alert('تم إنشاء PDF', file.uri);
    }
  } catch {
    Alert.alert('خطأ', 'تعذر إنشاء ملف PDF.');
  }
};
