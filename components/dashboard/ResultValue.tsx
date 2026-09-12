import React from 'react';
import {
  Moon, Eye, AlertTriangle, X as XIcon, Glasses, Syringe
} from 'lucide-react';
import { ResultStatus, TestDefinition, ExtractedResult } from '../../types';
import { includesTr } from '../../utils/lab';

interface ResultValueProps {
  test: TestDefinition;
  res?: ExtractedResult;
  status?: ResultStatus;
  isReviewed?: boolean;
}

const EyePartBadge: React.FC<{ text: string }> = ({ text }) => {
  let style = "bg-slate-100 text-slate-600";
  let icon = null;

  if (includesTr(text, "gece çalışabilir")) {
    style = "bg-green-100 text-green-700 border-green-200";
    icon = <Moon size={10} />;
  } else if (includesTr(text, "renk körlüğü yok")) {
    style = "bg-green-100 text-green-700 border-green-200";
    icon = <Eye size={10} />;
  } else if (includesTr(text, "renk körlüğü var")) {
    style = "bg-red-100 text-red-700 font-bold border-red-200";
    icon = <AlertTriangle size={10} />;
  } else if (includesTr(text, "çalışamaz")) {
    style = "bg-red-100 text-red-700 font-bold border-red-200";
    icon = <XIcon size={10} />;
  } else if (includesTr(text, "gözlük") || includesTr(text, "lens")) {
    style = "bg-blue-100 text-blue-700 border-blue-200";
    icon = <Glasses size={10} />;
  }

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1 w-fit max-w-full truncate font-medium ${style}`}>
      {icon} {text}
    </span>
  );
};

export const ResultValue: React.FC<ResultValueProps> = ({ test, res, status, isReviewed }) => {
  if (!res) {
    return <span className="text-slate-200 text-xl font-light">-</span>;
  }

  if (test.type === 'text' || test.subTests) {
    let badgeClass = "text-slate-700";
    if (status === ResultStatus.HIGH) badgeClass = "bg-red-100 text-red-700 border-red-200";

    if (typeof res.value !== 'string') {
      return <span className={`font-medium text-xs break-words max-w-[180px] inline-block py-1 px-2 rounded-lg ${badgeClass}`}>{res.value}</span>;
    }

    if (test.key.includes('goz') && res.value.includes('|')) {
      const parts = res.value.split('|').map(p => p.trim()).filter(Boolean);
      return (
        <div className="flex flex-col gap-1 items-center">
          {parts.map((p, idx) => <EyePartBadge key={idx} text={p} />)}
        </div>
      );
    }

    if (res.value.includes("Tetanoz aşısı yapılmıştır")) {
      return (
        <span className="font-bold text-[10px] py-1 px-2 rounded-full bg-green-100 text-green-700 border border-green-200 shadow-sm flex items-center justify-center gap-1">
          <Syringe size={10} />{res.value}
        </span>
      );
    }

    if (test.key.includes("kan_grubu")) {
      return <span className="font-black text-xs py-1 px-2 rounded bg-blue-100 text-blue-700 border border-blue-200">{res.value}</span>;
    }

    if (test.key.includes('_kart')) {
      if (test.key.includes('anti_hbs_kart')) {
        badgeClass = includesTr(res.value, 'pozitif')
          ? "bg-green-100 text-green-700 border border-green-200 font-bold"
          : "text-slate-400 bg-slate-100";
      } else if (includesTr(res.value, 'negatif')) {
        badgeClass = "bg-green-100 text-green-700 border border-green-200 font-bold";
      } else if (includesTr(res.value, 'pozitif')) {
        badgeClass = "bg-red-100 text-red-700 border border-red-200 font-bold";
      }
    }

    return <span className={`font-medium text-xs break-words max-w-[180px] inline-block py-1 px-2 rounded-lg ${badgeClass}`} title={res.value}>{res.value}</span>;
  }

  if (status === ResultStatus.HIGH) {
    return (
      <span className="inline-flex flex-col items-center">
        <span className="font-black text-red-600 text-base">{res.value}</span>
        <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-px rounded-full mt-0.5 font-bold tracking-wide border border-red-200">YÜKSEK</span>
      </span>
    );
  }

  if (status === ResultStatus.LOW) {
    return (
      <span className="inline-flex flex-col items-center">
        <span className="font-black text-orange-600 text-base">{res.value}</span>
        <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-px rounded-full mt-0.5 font-bold tracking-wide border border-orange-200">DÜŞÜK</span>
      </span>
    );
  }

  return <span className={`font-bold ${isReviewed ? 'text-slate-500' : 'text-slate-700'} text-base`}>{res.value}</span>;
};
