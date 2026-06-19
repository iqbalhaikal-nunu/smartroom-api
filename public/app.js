// app.js — shared helpers for the SmartRoom frontend
// Since the Node/Express API has no server-side session (unlike the original
// Java/JSP app), the logged-in user is kept in localStorage instead.

const SESSION_KEY = 'smartroomUser'; // stored as { userId, role }

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setSession(userId, role) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, role }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Call at the top of a protected page. Redirects to login if not logged in,
// or to the correct dashboard if logged in with the wrong role.
function requireLogin(requiredRole) {
  const session = getSession();
  if (!session || !session.userId) {
    window.location.href = 'login.html';
    return null;
  }
  if (requiredRole && session.role !== requiredRole) {
    window.location.href = session.role === 'admin' ? 'room-management.html' : 'dashboard.html';
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}
