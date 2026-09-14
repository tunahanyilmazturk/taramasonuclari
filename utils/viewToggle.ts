/** localStorage'dan başlangıç görünümünü okur */
export const getInitialView = (storageKey: string, defaultView: 'card' | 'list' = 'card'): 'card' | 'list' => {
  const saved = localStorage.getItem(`mediscan_view_${storageKey}`);
  return saved === 'list' || saved === 'card' ? saved : defaultView;
};
