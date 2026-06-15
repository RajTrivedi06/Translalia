/* Inline SVG icons — minimal, consistent stroke set */
const Icon = ({ name, size = 16, stroke = 1.6, ...rest }) => {
  const s = size;
  const sw = stroke;
  const common = {
    width: s, height: s, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: sw,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    ...rest,
  };
  switch (name) {
    case 'sliders':
      return <svg {...common}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="2" fill="currentColor" stroke="none"/></svg>;
    case 'flow':
      return <svg {...common}><rect x="3" y="4" width="6" height="6" rx="1.5"/><rect x="15" y="4" width="6" height="6" rx="1.5"/><rect x="9" y="14" width="6" height="6" rx="1.5"/><path d="M6 10v2h12v-2"/><path d="M12 12v2"/></svg>;
    case 'brain':
      return <svg {...common}><path d="M9 4a3 3 0 0 0-3 3v.5a3 3 0 0 0-2 5.5 3 3 0 0 0 2 5.5V19a3 3 0 0 0 6 0V4a3 3 0 0 0-3 0z"/><path d="M15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 5.5 3 3 0 0 1-2 5.5V19a3 3 0 0 1-6 0"/></svg>;
    case 'thought':
      return <svg {...common}><path d="M8 4h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-3l-3 3v-3H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"/><circle cx="6" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="3" cy="22" r="0.8" fill="currentColor" stroke="none"/></svg>;
    case 'chev-down':
      return <svg {...common}><polyline points="6 9 12 15 18 9"/></svg>;
    case 'chev-right':
      return <svg {...common}><polyline points="9 6 15 12 9 18"/></svg>;
    case 'chev-left':
      return <svg {...common}><polyline points="15 6 9 12 15 18"/></svg>;
    case 'arrow-left':
      return <svg {...common}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
    case 'x':
      return <svg {...common}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>;
    case 'play':
      return <svg {...common}><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>;
    case 'pause':
      return <svg {...common}><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></svg>;
    case 'reset':
      return <svg {...common}><polyline points="3 12 3 4 11 4"/><path d="M3 4l9 9a7 7 0 1 1-2 5"/></svg>;
    case 'lock':
      return <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case 'parse':
      return <svg {...common}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="M16 9l4 3-4 3"/></svg>;
    case 'split':
      return <svg {...common}><path d="M6 4v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v2"/><path d="M6 14v6"/><circle cx="6" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none"/></svg>;
    case 'send':
      return <svg {...common}><path d="M3 12l18-8-7 18-3-8-8-2z"/></svg>;
    case 'compare':
      return <svg {...common}><path d="M12 3v18"/><path d="M5 8l-3 4 3 4"/><path d="M19 8l3 4-3 4"/></svg>;
    case 'cache':
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>;
    case 'doc':
      return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>;
    case 'rhyme':
      return <svg {...common}><circle cx="6" cy="18" r="3"/><path d="M9 18V6l10-2v12"/><circle cx="16" cy="16" r="3"/></svg>;
    case 'check':
      return <svg {...common}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'plus':
      return <svg {...common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'save':
      return <svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
    case 'pencil':
      return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'star':
      return <svg {...common}><polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9 12 2"/></svg>;
    case 'collapse-h':
      return <svg {...common}><path d="M9 3v18"/><polyline points="14 8 18 12 14 16"/></svg>;
    case 'verify':
      return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><polyline points="9 12 11 14 15 10"/></svg>;
    case 'graph':
      return <svg {...common}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="8" y1="18" x2="16" y2="18"/></svg>;
    case 'wand':
      return <svg {...common}><path d="M15 4V2"/><path d="M15 10V8"/><path d="M19 6h-2"/><path d="M13 6h-2"/><path d="M3 21l12-12"/><path d="M14 5l5 5"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="3"/></svg>;
  }
};

window.Icon = Icon;
