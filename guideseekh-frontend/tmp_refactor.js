const fs = require('fs');

const file = 'c:/Users/manav/Desktop/Friends-/guideseekh-frontend/app/chat/page.jsx';
let content = fs.readFileSync(file, 'utf8');

// The exact accent hex that matches oklch(64.6% 0.222 41.116) is roughly #FF5500. Let's use the arbitrary value syntax of tailwind: bg-[#FF5500].
const ACCENT = '#FF5500';

content = content.replace(/bg-gradient-to-br from-\[#0a0014\] to-\[#1a0033\]/g, 'bg-[#000000]');

content = content.replace(/text-violet-400/g, `text-[${ACCENT}]`);
content = content.replace(/bg-violet-400/g, `bg-[${ACCENT}]`);

content = content.replace(/bg-violet-600\/20/g, `bg-[${ACCENT}]/20`);
content = content.replace(/bg-violet-[0-9]+\/([0-9]+)/g, `bg-[${ACCENT}]/$1`);

content = content.replace(/border-violet-[0-9]+\/([0-9]+)/g, `border-[${ACCENT}]/$1`);
content = content.replace(/border-violet-[0-9]+/g, `border-[${ACCENT}]`);
content = content.replace(/focus:border-violet-[0-9]+/g, `focus:border-[${ACCENT}]`);
content = content.replace(/focus:ring-violet-[0-9]+/g, `focus:ring-[${ACCENT}]`);

content = content.replace(/bg-gradient-to-r from-violet-[0-9]+ via-violet-[0-9]+ to-indigo-[0-9]+/g, `bg-[${ACCENT}]`);
content = content.replace(/bg-gradient-to-r from-violet-[0-9]+ to-indigo-[0-9]+/g, `bg-[${ACCENT}]`);
content = content.replace(/hover:shadow-\[0_0_24px_-4px_rgba\(217,70,239,0\.8\)\]/g, `hover:shadow-[0_0_24px_-4px_${ACCENT}]`);

content = content.replace(/text-indigo-400/g, `text-[${ACCENT}]`);
content = content.replace(/bg-indigo-600\/20/g, `bg-[${ACCENT}]/20`);

content = content.replace(/from-violet-50 to-violet-100/g, 'from-orange-100 to-[#FF5500]');

fs.writeFileSync(file, content, 'utf8');
console.log("Refactored chat/page.jsx");
