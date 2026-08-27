// Central API configuration.
// Change ONLY this URL when moving the website to your production domain.
const API = "http://127.0.0.1:5000";

function imageUrl(name, fallbackSeed = "") {
  if (!name) return "https://picsum.photos/500/400?random=" + fallbackSeed;
  if (/^https?:\/\//i.test(String(name))) return String(name);
  return `${API}/uploads/products/${encodeURIComponent(name)}`;
}
