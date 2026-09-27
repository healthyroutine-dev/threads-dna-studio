// 선 아이콘 (24px 격자). 색은 currentColor 를 따라갑니다.
const P = {
  chat: '<path d="M20.5 11.3a8.3 8.3 0 0 1-8.5 8.2 8.9 8.9 0 0 1-3.9-.9L3.5 19.8l1.2-4A8 8 0 0 1 3.5 11.3 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 8.5 8.3z"/>',
  calendar: '<rect x="3.2" y="4.6" width="17.6" height="16" rx="2.6"/><path d="M3.2 9.6h17.6M8 2.6v4M16 2.6v4"/>',
  mail: '<rect x="2.8" y="5" width="18.4" height="14" rx="2.6"/><path d="m3.4 6.6 8.6 6.3 8.6-6.3"/>',
  check: '<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7.2 5.1v13.8a.8.8 0 0 0 1.2.7l10.9-6.9a.8.8 0 0 0 0-1.4L8.4 4.4a.8.8 0 0 0-1.2.7z"/>',
  heart: '<path d="M12 20s-7.6-4.5-7.6-10a4.3 4.3 0 0 1 7.6-2.8A4.3 4.3 0 0 1 19.6 10c0 5.5-7.6 10-7.6 10z"/>',
  comment: '<path d="M20.4 11.6a8.4 8.4 0 0 1-12.5 7.3l-4.4 1.5 1.5-4.3a8.4 8.4 0 1 1 15.4-4.5z"/>',
  chart: '<path d="M4.5 19.5v-6M10 19.5V5M15.5 19.5v-9M21 19.5H3"/>',
  arrow: '<path d="M4.5 12h15M13.5 5.8 19.7 12l-6.2 6.2"/>',
  lock: '<rect x="5" y="10.4" width="14" height="10" rx="2.2"/><path d="M8.2 10.4V7.9a3.8 3.8 0 0 1 7.6 0v2.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
