import { describe, it, expect } from 'vitest';
import {
  calculateStatus, isAbnormalStatus, flattenTests, findTestById,
  parseTrDate, computeRecordValues, normalizeTr, includesTr
} from './lab';
import { ResultStatus, TestDefinition } from '../types';

const numTest = (over: Partial<TestDefinition> = {}): TestDefinition => ({
  id: 't1', key: 'wbc', name: 'WBC', unit: 'K/uL', type: 'numeric',
  range: { min: 4, max: 10 }, ...over
});

const textTest = (over: Partial<TestDefinition> = {}): TestDefinition => ({
  id: 't2', key: 'ekg', name: 'EKG', unit: 'Sonuç', type: 'text', ...over
});

const panel = (...subs: TestDefinition[]): TestDefinition => ({
  id: 'panel1', key: 'hemogram', name: 'Hemogram', unit: 'Panel',
  type: 'numeric', subTests: subs
});

describe('calculateStatus', () => {
  it('aralık içi değer NORMAL döner', () => {
    expect(calculateStatus(7, { min: 4, max: 10 })).toBe(ResultStatus.NORMAL);
  });

  it('max üstü HIGH, min altı LOW döner', () => {
    expect(calculateStatus(12, { min: 4, max: 10 })).toBe(ResultStatus.HIGH);
    expect(calculateStatus(2, { min: 4, max: 10 })).toBe(ResultStatus.LOW);
  });

  it('sınır değerler NORMAL sayılır', () => {
    expect(calculateStatus(4, { min: 4, max: 10 })).toBe(ResultStatus.NORMAL);
    expect(calculateStatus(10, { min: 4, max: 10 })).toBe(ResultStatus.NORMAL);
  });

  it('string sayısal değer parse edilir', () => {
    expect(calculateStatus('12.5', { min: 4, max: 10 })).toBe(ResultStatus.HIGH);
  });

  it('NEGATİF içeren metin her zaman NORMAL', () => {
    expect(calculateStatus('NEGATİF', { min: 4, max: 10 })).toBe(ResultStatus.NORMAL);
    expect(calculateStatus('Sonuç: Negatif', undefined, 'numeric', 'hbsag_kart')).toBe(ResultStatus.NORMAL);
    expect(calculateStatus('negatif')).toBe(ResultStatus.NORMAL);
  });

  it('text tipi UNKNOWN döner', () => {
    expect(calculateStatus('Normal Sinüs Ritmi', undefined, 'text')).toBe(ResultStatus.UNKNOWN);
  });

  it('range yoksa veya değer sayısal değilse UNKNOWN', () => {
    expect(calculateStatus(5)).toBe(ResultStatus.UNKNOWN);
    expect(calculateStatus('abc', { min: 4, max: 10 })).toBe(ResultStatus.UNKNOWN);
  });

  it('anti_hbs: min altı LOW, üstü (max aşsa bile) NORMAL', () => {
    const range = { min: 10, max: 1000 };
    expect(calculateStatus(5, range, 'numeric', 'anti_hbs_val')).toBe(ResultStatus.LOW);
    expect(calculateStatus(5000, range, 'numeric', 'anti_hbs_val')).toBe(ResultStatus.NORMAL);
    expect(calculateStatus(10, range, 'numeric', 'anti_hbs_kart')).toBe(ResultStatus.NORMAL);
  });
});

describe('isAbnormalStatus', () => {
  it('HIGH ve LOW anormal sayılır', () => {
    expect(isAbnormalStatus(ResultStatus.HIGH)).toBe(true);
    expect(isAbnormalStatus(ResultStatus.LOW)).toBe(true);
  });
  it('NORMAL, UNKNOWN ve undefined normal sayılır', () => {
    expect(isAbnormalStatus(ResultStatus.NORMAL)).toBe(false);
    expect(isAbnormalStatus(ResultStatus.UNKNOWN)).toBe(false);
    expect(isAbnormalStatus(undefined)).toBe(false);
  });
});

describe('flattenTests / findTestById', () => {
  const tests = [
    numTest(),
    panel(numTest({ id: 's1', key: 'hgb', name: 'Hemoglobin' }), numTest({ id: 's2', key: 'plt', name: 'Platelet' })),
    textTest()
  ];

  it('panel testleri alt testlerine açar', () => {
    const flat = flattenTests(tests);
    expect(flat.map(t => t.id)).toEqual(['t1', 's1', 's2', 't2']);
  });

  it('içi boş subTests panel olarak açılmaz', () => {
    const t = panel();
    t.subTests = [];
    expect(flattenTests([t])).toEqual([t]);
  });

  it('findTestById alt testi bulur', () => {
    expect(findTestById(tests, 's2')?.name).toBe('Platelet');
    expect(findTestById(tests, 't1')?.name).toBe('WBC');
    expect(findTestById(tests, 'yok')).toBeUndefined();
  });
});

describe('normalizeTr', () => {
  it('İ/I/ı/i varyasyonlarını tek forma indirger', () => {
    expect(normalizeTr('POZİTİF')).toBe('pozitif');
    expect(normalizeTr('POZITIF')).toBe('pozitif');
    expect(normalizeTr('Negatif')).toBe('negatif');
    expect(normalizeTr('İŞİTME')).toBe('işitme');
  });

  it('ı harfi de i kanonik formuna çekilir', () => {
    expect(normalizeTr('Çalışamaz')).toBe('çalişamaz');
  });

  it('Türkçe diğer harfleri korur', () => {
    expect(normalizeTr('Renk Körlüğü Yok')).toBe('renk körlüğü yok');
  });
});

describe('includesTr', () => {
  it('her iki tarafı normalize ederek eşleştirir', () => {
    expect(includesTr('Gece ÇALIŞAMAZ', 'gece çalışamaz')).toBe(true);
    expect(includesTr('Renk KÖRLÜĞÜ VAR', 'renk körlüğü var')).toBe(true);
    expect(includesTr('İşitme Kaybı Var', 'kaybı var')).toBe(true);
    expect(includesTr('Normal', 'pozitif')).toBe(false);
  });
});

describe('parseTrDate', () => {
  it('DD.MM.YYYY formatını çözer', () => {
    expect(parseTrDate('15.03.2024')).toBe(new Date(2024, 2, 15).getTime());
  });

  it('ISO formatını çözer', () => {
    expect(parseTrDate('2024-03-15')).toBe(new Date('2024-03-15').getTime());
  });
});

describe('computeRecordValues', () => {
  it('tekil test için results ve statusMap üretir', () => {
    const { results, statusMap } = computeRecordValues(
      [numTest()], def => def.id === 't1' ? '12.5' : undefined
    );
    expect(results['t1']).toEqual({ testName: 'WBC', value: 12.5, unit: 'K/uL' });
    expect(statusMap['t1']).toBe(ResultStatus.HIGH);
  });

  it('virgüllü ondalık değeri sayıya çevirir', () => {
    const { results } = computeRecordValues([numTest()], () => '7,5');
    expect(results['t1'].value).toBe(7.5);
  });

  it('boş ve undefined değerleri atlar', () => {
    const { results, statusMap } = computeRecordValues(
      [numTest(), textTest()],
      def => def.id === 't2' ? '   ' : undefined
    );
    expect(Object.keys(results)).toHaveLength(0);
    expect(Object.keys(statusMap)).toHaveLength(0);
  });

  it('panel: tüm alt testler normalse özet "Normal"', () => {
    const p = panel(numTest({ id: 's1', name: 'Hgb' }), numTest({ id: 's2', name: 'Plt' }));
    const { results, statusMap } = computeRecordValues([p], () => '5');
    expect(results['panel1'].value).toBe('Normal');
    expect(statusMap['panel1']).toBe(ResultStatus.NORMAL);
    expect(statusMap['s1']).toBe(ResultStatus.NORMAL);
    expect(statusMap['s2']).toBe(ResultStatus.NORMAL);
  });

  it('panel: anormal alt testler özetlenir ve panel HIGH olur', () => {
    const p = panel(numTest({ id: 's1', name: 'Hgb' }), numTest({ id: 's2', name: 'Plt' }));
    const { results, statusMap } = computeRecordValues(
      [p],
      def => def.id === 's1' ? '20' : '5'
    );
    expect(results['panel1'].value).toContain('Hgb Yüksek (20)');
    expect(statusMap['panel1']).toBe(ResultStatus.HIGH);
  });

  it('panelde hiç veri yoksa panel sonucu üretilmez', () => {
    const p = panel(numTest({ id: 's1', name: 'Hgb' }));
    const { results } = computeRecordValues([p], () => undefined);
    expect(results['panel1']).toBeUndefined();
    expect(results['s1']).toBeUndefined();
  });
});
