const config = {
  // Paste a direct image URL here (Discord CDN links work well). Leave blank for no banner.
  panelBannerUrl: 'https://yumi.onl/api/files/6a6789a2e4b985f0ff91fa68/raw',
  adminRoleId: '1529922817578106959',
  supportRoleId: '1529922817578106958',
  logChannelId: process.env.TICKET_LOG_CHANNEL_ID || '1529922818253390018',
  parentCategoryId: process.env.TICKET_PARENT_CATEGORY_ID || '1529922818253390016',
  autoCloseAfterHours: 12,
  categories: [
    { id: 'staffing', label: 'Staffing', emoji: '🍗', description: 'Employment, staff reports, applications, or promotions.', color: 0xF97316 },
    { id: 'relations', label: 'Relations Department', emoji: '🗂️', description: 'Affiliates, partnerships, events, advertising, or external relations.', color: 0x6366F1 },
    { id: 'general', label: 'General Support', emoji: '🍗', description: 'General questions, guidance, and requests.', color: 0x22C55E },
    { id: 'development', label: 'Development', emoji: '💻', description: 'Technical issues, bugs, and development requests.', color: 0x06B6D4 }
  ]
};

module.exports = config;