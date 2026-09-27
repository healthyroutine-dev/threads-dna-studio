// 선 아이콘 (24px 격자). 색은 currentColor 를 따라갑니다.
const P = {
  card: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.4"/><path d="M2.8 9.6h18.4M6.4 15h4"/>',
  camera: '<path d="M4.4 7.6h3l1.6-2.2h6l1.6 2.2h3a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6V9.2a1.6 1.6 0 0 1 1.6-1.6z"/><circle cx="12" cy="13.2" r="3.6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevron: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7.2 5.1v13.8a.8.8 0 0 0 1.2.7l10.9-6.9a.8.8 0 0 0 0-1.4L8.4 4.4a.8.8 0 0 0-1.2.7z"/>',
  check: '<path d="m5.5 12.6 4.2 4.2 8.8-9"/>',
  arrow: '<path d="M4.5 12h15M13.5 5.8 19.7 12l-6.2 6.2"/>',
  lock: '<rect x="5" y="10.4" width="14" height="10" rx="2.2"/><path d="M8.2 10.4V7.9a3.8 3.8 0 0 1 7.6 0v2.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
