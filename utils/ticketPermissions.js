'use strict';

const config = require('../ticketConfig.json');

/** Resolve the set of permission "keys" (e.g. 'management', 'owner') a member holds. */
function getMemberPermissionKeys(member) {
  const keys = new Set();
  const roleMap = config.permissions.roles;
  for (const [key, roleId] of Object.entries(roleMap)) {
    if (roleId && member.roles.cache.has(roleId)) keys.add(key);
  }
  if (member.permissions.has('Administrator')) keys.add('administrators');
  return keys;
}

/** Is this member considered "staff" (any staff role) at all? */
function isStaff(member) {
  if (member.permissions.has('Administrator')) return true;
  const staffIds = config.permissions.staffRoleIds || [];
  if (staffIds.some(id => id && member.roles.cache.has(id))) return true;
  const keys = getMemberPermissionKeys(member);
  return keys.size > 0;
}

/** Can this member access tickets of a given category? */
function canAccessCategory(member, categoryKey) {
  const category = config.categories[categoryKey];
  if (!category) return false;
  if (member.permissions.has('Administrator')) return true;
  const memberKeys = getMemberPermissionKeys(member);
  return category.accessRoles.some(role => memberKeys.has(role));
}

/** Is a given action restricted to admin-tier roles per config? */
function isAdminOnlyAction(action) {
  return (config.permissions.adminOnlyActions || []).includes(action);
}

function canPerformAction(member, action, categoryKey) {
  if (member.permissions.has('Administrator')) return true;
  if (isAdminOnlyAction(action)) {
    const keys = getMemberPermissionKeys(member);
    return keys.has('owner') || keys.has('executive') || keys.has('administrators');
  }
  if (categoryKey) return canAccessCategory(member, categoryKey);
  return isStaff(member);
}

module.exports = {
  getMemberPermissionKeys,
  isStaff,
  canAccessCategory,
  isAdminOnlyAction,
  canPerformAction
};