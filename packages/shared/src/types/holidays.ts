// ─────────────────────────────────────────────────────────────
// Islamic Holidays — matches firmware enum
// ─────────────────────────────────────────────────────────────

export enum IslamicHoliday {
  NONE = 'none',
  MUHARRAM_1 = 'muharram',         // 1 Muharram — Islamic New Year
  ASHURA = 'ashura',               // 10 Muharram
  MAWLID = 'mawlid',              // 12 Rabi al-Awwal
  ISRA_MIRAJ = 'israMiraj',       // 27 Rajab
  RAMADAN_START = 'ramadanStart',  // 1 Ramadan
  LAYLAT_AL_QADR = 'laylatAlQadr', // 27 Ramadan
  EID_FITR = 'eidFitr',           // 1 Shawwal
  EID_ADHA = 'eidAdha',           // 10 Dhul Hijjah
}

export interface HolidayInfo {
  key: IslamicHoliday;
  name: string;
  hijriMonth: number;
  hijriDay: number;
  description: string;
}

export const ISLAMIC_HOLIDAYS: HolidayInfo[] = [
  { key: IslamicHoliday.MUHARRAM_1, name: 'Islamic New Year', hijriMonth: 1, hijriDay: 1, description: 'Start of the Islamic calendar year' },
  { key: IslamicHoliday.ASHURA, name: 'Ashura', hijriMonth: 1, hijriDay: 10, description: 'Day of Ashura' },
  { key: IslamicHoliday.MAWLID, name: 'Mawlid al-Nabi', hijriMonth: 3, hijriDay: 12, description: 'Birth of Prophet Muhammad (PBUH)' },
  { key: IslamicHoliday.ISRA_MIRAJ, name: "Isra' & Mi'raj", hijriMonth: 7, hijriDay: 27, description: 'Night Journey and Ascension' },
  { key: IslamicHoliday.RAMADAN_START, name: 'Ramadan Begins', hijriMonth: 9, hijriDay: 1, description: 'First day of Ramadan' },
  { key: IslamicHoliday.LAYLAT_AL_QADR, name: 'Laylat al-Qadr', hijriMonth: 9, hijriDay: 27, description: 'Night of Power' },
  { key: IslamicHoliday.EID_FITR, name: 'Eid al-Fitr', hijriMonth: 10, hijriDay: 1, description: 'Festival of Breaking the Fast' },
  { key: IslamicHoliday.EID_ADHA, name: 'Eid al-Adha', hijriMonth: 12, hijriDay: 10, description: 'Festival of Sacrifice' },
];
