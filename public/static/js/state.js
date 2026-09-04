// Global app state (simple pub/sub, no framework)
const STATE = {
  user: null,
  currentPage: 'executive',
  currentMonth: null, // null == live
  listeners: [],
  liveMonth: null,
  months: [],
};

function setUser(u) {
  STATE.user = u;
}

function isSuperAdmin() { return STATE.user && STATE.user.role === 'super_admin'; }
function isDemo() { return STATE.user && STATE.user.role === 'demo'; }
function canExportRole() { return STATE.user && STATE.user.role !== 'demo'; }

function roleLabel(role) {
  return { super_admin: 'Super Admin', demo: 'Demo', single_user: 'Single User', multi_user: 'Multi User' }[role] || role;
}
