import React from 'react';
import { PlaceholderPage } from '../PlaceholderPage';
import { Package, Wrench, Truck, BadgeCheck, Boxes } from 'lucide-react';

interface EquipmentProps {
  onGoToDashboard?: () => void;
}

export const Equipment: React.FC<EquipmentProps> = ({ onGoToDashboard }) => {
  return (
    <PlaceholderPage
      icon={Package}
      iconBg="bg-orange-500"
      iconColor="text-white"
      title="Ekipman"
      subtitle="Mobil tarama araçlarınızı, cihazlarınızı ve sarf malzemelerinizi envanter olarak yönetin."
      onGoToDashboard={onGoToDashboard}
      features={[
        {
          icon: Truck,
          title: 'Mobil Araç Takibi',
          description: 'Tarama araçlarının donanım listesi, bakım ve muayene tarihleri.'
        },
        {
          icon: Wrench,
          title: 'Kalibrasyon Takibi',
          description: 'Odyometre, SFT, EKG gibi cihazların kalibrasyon geçmişi ve yaklaşan tarihleri.'
        },
        {
          icon: Boxes,
          title: 'Sarf Malzeme Stoku',
          description: 'İdrar kabı, iğne, eldiven gibi sarf malzemelerin stok ve kritik seviye uyarıları.'
        },
        {
          icon: BadgeCheck,
          title: 'Zimmetleme',
          description: 'Ekipmanın hangi ekip/taramada olduğunu takip eden atama kayıtları.'
        }
      ]}
    />
  );
};
