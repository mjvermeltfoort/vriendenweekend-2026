export type DevicePlatform = 'android' | 'ios' | 'other';
export type DeviceBrowser = 'chrome' | 'safari' | 'other';

export interface LocationDevice {
  platform: DevicePlatform;
  browser: DeviceBrowser;
  name: string;
}

export interface HelpLink {
  title: string;
  url: string;
}

export interface LocationGuide {
  title: string;
  steps: string[];
  links: HelpLink[];
}

const ANDROID_LOCATION_HELP = 'https://support.google.com/android/answer/3467281?hl=nl';
const ANDROID_CHROME_HELP = 'https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DAndroid&hl=nl';
const IOS_CHROME_HELP = 'https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DiOS&hl=nl-NL';
const IOS_LOCATION_HELP = 'https://support.apple.com/nl-nl/102515';
const IOS_SAFARI_HELP = 'https://support.apple.com/nl-nl/guide/iphone/iphb01fc3c85/ios';

export function detectLocationDevice(userAgent: string, maxTouchPoints = 0): LocationDevice {
  const ios = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);
  const chrome = /CriOS/i.test(userAgent)
    || (/Chrome\//i.test(userAgent) && !/Edg|OPR|SamsungBrowser|UCBrowser/i.test(userAgent));
  const safari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|OPR/i.test(userAgent);

  if (ios) {
    if (chrome) return { platform: 'ios', browser: 'chrome', name: 'iPhone/iPad · Chrome' };
    if (safari) return { platform: 'ios', browser: 'safari', name: 'iPhone/iPad · Safari' };
    return { platform: 'ios', browser: 'other', name: 'iPhone/iPad' };
  }
  if (android) {
    return { platform: 'android', browser: chrome ? 'chrome' : 'other', name: chrome ? 'Android · Chrome' : 'Android' };
  }
  return { platform: 'other', browser: chrome ? 'chrome' : safari ? 'safari' : 'other', name: 'Browser' };
}

export function getLocationGuide(device: LocationDevice): LocationGuide {
  if (device.platform === 'android') {
    return {
      title: device.name,
      steps: [
        'Open Instellingen op je telefoon → Locatie en zet Locatie gebruiken aan.',
        'Ga naar Instellingen → Apps → je browser → Machtigingen → Locatie. Sta locatie toe tijdens gebruik en kies Exacte locatie indien beschikbaar.',
        device.browser === 'chrome'
          ? 'Open deze site in Chrome. Tik links van de adresbalk op het site-icoon → Rechten → Locatie → Toestaan. Of kijk bij Chrome → Instellingen → Site-instellingen → Locatie.'
          : 'Open deze site in je browser en sta locatiegebruik toe via de site-instellingen.',
        'Ga bij voorkeur even naar buiten. Zet zo nodig Instellingen → Locatie → Locatieservices → Locatienauwkeurigheid verbeteren aan. Keer terug en test opnieuw.'
      ],
      links: [
        ...(device.browser === 'chrome' ? [{ title: 'Locatie toestaan in Chrome', url: ANDROID_CHROME_HELP }] : []),
        { title: 'Android-locatieinstellingen', url: ANDROID_LOCATION_HELP }
      ]
    };
  }

  if (device.platform === 'ios' && device.browser === 'chrome') {
    return {
      title: device.name,
      steps: [
        'Open Instellingen → Privacy en beveiliging → Locatievoorzieningen en schakel deze in.',
        'Kies Chrome bij Locatievoorzieningen (of via Instellingen → Apps → Chrome → Locatie). Sta locatie toe bij gebruik van de app en zet Exacte locatie aan.',
        'Open de spelwebsite opnieuw in Chrome. Kies Sta toe als Chrome om je locatie vraagt.',
        'Ga zo nodig naar buiten en tik in de app op Opnieuw testen.'
      ],
      links: [
        { title: 'Chrome op iPhone instellen', url: IOS_CHROME_HELP },
        { title: 'Locatievoorzieningen op iPhone', url: IOS_LOCATION_HELP }
      ]
    };
  }

  if (device.platform === 'ios') {
    return {
      title: device.name,
      steps: [
        'Open Instellingen → Privacy en beveiliging → Locatievoorzieningen en schakel deze in.',
        device.browser === 'safari'
          ? 'Tik bij Locatievoorzieningen op Safari-websites. Kies Bij gebruik van app en zet Exacte locatie aan.'
          : 'Kies de browser bij Locatievoorzieningen. Sta locatie toe bij gebruik van de app en zet Exacte locatie aan.',
        device.browser === 'safari'
          ? 'Open de website in Safari en tik op het paginamenu bij de adresbalk → Website-instellingen → Locatie → Sta toe. Controleer eventueel Instellingen → Apps → Safari → Locatie.'
          : 'Open de spelwebsite opnieuw in je browser en sta locatietoegang toe.',
        'Keer terug naar het spel en tik op Opnieuw testen.'
      ],
      links: [
        ...(device.browser === 'safari' ? [{ title: 'Safari-websiteinstellingen', url: IOS_SAFARI_HELP }] : []),
        { title: 'Locatievoorzieningen op iPhone', url: IOS_LOCATION_HELP }
      ]
    };
  }

  return {
    title: 'Locatie in je browser',
    steps: [
      'Schakel locatievoorzieningen in via de instellingen van je apparaat.',
      'Open het slotje of site-icoon bij de adresbalk en sta Locatie toe voor deze website.',
      'Vernieuw de pagina, ga indien mogelijk naar buiten en kies Opnieuw testen.'
    ],
    links: [
      { title: 'Chrome-locatieinstellingen', url: ANDROID_CHROME_HELP },
      { title: 'Apple-locatievoorzieningen', url: IOS_LOCATION_HELP }
    ]
  };
}

export function locationAccuracyState(accuracy: number): 'ready' | 'imprecise' {
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 40 ? 'ready' : 'imprecise';
}
