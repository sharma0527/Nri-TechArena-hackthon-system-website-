// ─── Central API Configuration ─────────────────────────────────────────────────
// Change VITE_API_URL in .env to switch between local and production:
//   Local:      VITE_API_URL=http://localhost:5000
//   Production: VITE_API_URL=https://techarena-api-0ys3.onrender.com
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
export default API;
