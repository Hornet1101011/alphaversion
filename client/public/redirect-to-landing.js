// Redirect to landing page if not logged in (for static HTML fallback)
if (window.location.pathname === '/index.html' || window.location.pathname === '/public/index.html') {
  window.location.replace('/');
}
