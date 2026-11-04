export {};
declare global {
  interface Window {
    __PORTFOLIO_PREVIEW__?: {
      records: any[];
      profile: { intro: string; contact: string; links: string };
    };
  }
}
