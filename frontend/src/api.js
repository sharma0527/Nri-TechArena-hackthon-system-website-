// ─── Central API Configuration ─────────────────────────────────────────────────
// Change VITE_API_URL in .env to switch between local and production:
//   Local:      VITE_API_URL=http://localhost:5000
// Production: https://nri-techarena-hackthon-system-website-3.onrender.com
const API = import.meta.env.VITE_API_URL || "https://nri-techarena-hackthon-system-website-3.onrender.com";
export default API;
