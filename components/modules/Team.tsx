import React from 'react';
import { PlaceholderPage } from '../PlaceholderPage';
import { HardHat, IdCard, Award, UserCheck, ClipboardList } from 'lucide-react';

interface TeamProps {
  onGoToDashboard?: () => void;
}

export const Team: React.FC<TeamProps> = ({ onGoToDashboard }) => {
  return (
    <PlaceholderPage
      icon={HardHat}
      iconBg="bg-violet-600"
      iconColor="text-white"
      title="Ekip"
      subtitle="Saha sağlık personelinizi, sertifikalarını ve tarama atamalarını yönetin."
      onGoToDashboard={onGoToDashboard}
      features={[
        {
          icon: IdCard,
          title: 'Personel Kartları',
          description: 'Hemşire, teknisyen, hekim ve sürücü rolleriyle saha ekibi kayıtları.'
        },
        {
          icon: Award,
          title: 'Sertifika & Yetki Takibi',
          description: 'İlkyardım, hijyen, cihaz yetki belgeleri ve geçerlilik tarihi uyarıları.'
        },
        {
          icon: UserCheck,
          title: 'Tarama Atamaları',
          description: 'Personelin hangi taramada görevli olduğu ve müsaitlik durumu.'
        },
        {
          icon: ClipboardList,
          title: 'Görev Geçmişi',
          description: 'Personel bazlı katıldığı taramalar ve saha performans kayıtları.'
        }
      ]}
    />
  );
};
