import { ResultStatus, TestDefinition, TestType, ExtractedResult } from '../types';

/**
 * Türkçe metinleri karşılaştırma için kanonik forma indirger.
 * JS'de 'İ'.toLowerCase() → 'i̇' (birleşen nokta) ve 'I'.toLocaleLowerCase('tr') → 'ı'
 * olduğundan basit toLowerCase kontrolleri hem büyük İ'li hem düz I'lı yazımları kaçırır.
 * Örn: 'POZİTİF' → 'pozitif', 'POZITIF' → 'pozitif', 'Negatif' → 'negatif', 'İŞİTME' → 'işitme'
 */
export const normalizeTr = (s: string): string =>
  s.toLocaleLowerCase('tr').replace(/ı/g, 'i');

/** Türkçe-güvenli includes: hem metin hem iğne normalize edilir. */
export const includesTr = (haystack: string, needle: string): boolean =>
  normalizeTr(haystack).includes(normalizeTr(needle));

/** Bir değeri referans aralığına göre Normal/Düşük/Yüksek/Belirsiz olarak sınıflandırır. */
export const calculateStatus = (
  val: number | string,
  range?: { min: number; max: number },
  type: TestType = 'numeric',
  testKey?: string
): ResultStatus => {
  if (typeof val === 'string' && includesTr(val, 'negatif')) {
    return ResultStatus.NORMAL;
  }

  if (type === 'text') return ResultStatus.UNKNOWN;
  const numVal = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(numVal) || !range) return ResultStatus.UNKNOWN;

  // Anti-HBs için sadece min altı riskli (bağışıklık eşiği)
  if (testKey?.includes('anti_hbs')) {
    if (numVal < range.min) return ResultStatus.LOW;
    return ResultStatus.NORMAL;
  }

  if (numVal < range.min) return ResultStatus.LOW;
  if (numVal > range.max) return ResultStatus.HIGH;
  return ResultStatus.NORMAL;
};

export const isAbnormalStatus = (status?: ResultStatus): boolean =>
  status === ResultStatus.HIGH || status === ResultStatus.LOW;

/** Panel testlerini alt testlerine indirgeyerek düz liste döndürür. */
export const flattenTests = (tests: TestDefinition[]): TestDefinition[] =>
  tests.flatMap(t => (t.subTests && t.subTests.length > 0 ? t.subTests : [t]));

/** Panel hiyerarşisi dahil test id'sine göre tanım bulur. */
export const findTestById = (tests: TestDefinition[], id: string): TestDefinition | undefined =>
  flattenTests(tests).find(t => t.id === id);

/** "DD.MM.YYYY" veya ISO formatındaki Türkçe tarihi timestamp'e çevirir. */
export const parseTrDate = (d: string): number => {
  if (d.includes('.')) {
    const [day, month, year] = d.split('.').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  }
  return new Date(d).getTime();
};

export interface RecordComputation {
  results: Record<string, ExtractedResult>;
  statusMap: Record<string, ResultStatus>;
}

/**
 * Test tanımları ve bir değer sağlayıcıdan results/statusMap üretir.
 * Hem AI çıkarımı hem manuel giriş aynı mantığı kullanır.
 * Panel testleri için anormal alt bulgular özetlenerek panele yazılır.
 */
export const computeRecordValues = (
  tests: TestDefinition[],
  getValue: (def: TestDefinition) => number | string | undefined
): RecordComputation => {
  const results: Record<string, ExtractedResult> = {};
  const statusMap: Record<string, ResultStatus> = {};

  tests.forEach(test => {
    if (test.subTests && test.subTests.length > 0) {
      const abnormalFindings: string[] = [];
      let panelHasData = false;

      test.subTests.forEach(sub => {
        const rawVal = getValue(sub);
        if (rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) return;

        panelHasData = true;
        const finalVal = normalizeValue(rawVal, sub.type);
        const subStatus = calculateStatus(finalVal, sub.range, sub.type, sub.key);

        results[sub.id] = { testName: sub.name, value: finalVal, unit: sub.unit };
        statusMap[sub.id] = subStatus;

        if (subStatus === ResultStatus.HIGH) abnormalFindings.push(`${sub.name} Yüksek (${finalVal})`);
        else if (subStatus === ResultStatus.LOW) abnormalFindings.push(`${sub.name} Düşük (${finalVal})`);
      });

      if (panelHasData) {
        if (abnormalFindings.length === 0) {
          results[test.id] = { testName: test.name, value: 'Normal', unit: 'Panel' };
          statusMap[test.id] = ResultStatus.NORMAL;
        } else {
          results[test.id] = { testName: test.name, value: abnormalFindings.join(', '), unit: 'Panel' };
          statusMap[test.id] = ResultStatus.HIGH;
        }
      }
    } else {
      const rawVal = getValue(test);
      if (rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) return;

      const finalVal = normalizeValue(rawVal, test.type);
      results[test.id] = { testName: test.name, value: finalVal, unit: test.unit };
      statusMap[test.id] = calculateStatus(finalVal, test.range, test.type, test.key);
    }
  });

  return { results, statusMap };
};

const normalizeValue = (rawVal: number | string, type: TestType): number | string => {
  if (type !== 'numeric') return typeof rawVal === 'string' ? rawVal.trim() : rawVal;
  const parsed = parseFloat(String(rawVal).replace(',', '.'));
  return isNaN(parsed) ? String(rawVal).trim() : parsed;
};
