import React from 'react';
import { PlaceholderPage } from '../PlaceholderPage';
import { CalendarDays, CalendarRange, BellRing, Route, Link2 } from 'lucide-react';

interface CalendarProps {
  onGoToDashboard?: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onGoToDashboard }) => {
  return (
    <PlaceholderPage
      icon={CalendarDays}
      iconBg="bg-indigo-600"
      iconColor="text-white"
      title="Takvim"
      subtitle="Tarama programlarını, ekip atamalarını ve randevuları takvim görünümünde yönetin."
      onGoToDashboard={onGoToDashboard}
      features={[
        {
          icon: CalendarRange,
          title: 'Aylık & Haftalık Görünüm',
          description: 'Planlanan tüm taramaları ay ve hafta bazında renkli takvimde görün.'
        },
        {
          icon: Route,
          title: 'Ekip Çakışma Kontrolü',
          description: 'Aynı güne birden fazla ekip/araç atamasını önleyen uyarı sistemi.'
        },
        {
          icon: BellRing,
          title: 'Hatırlatmalar',
          description: 'Yaklaşan taramalar, kalibrasyon tarihleri ve belge yenileme uyarıları.'
        },
        {
          icon: Link2,
          title: 'Tarama Bağlantısı',
          description: 'Takvim gününden ilgili taramaya ve firma kaydına tek tıkla geçiş.'
        }
      ]}
    />
  );
};
