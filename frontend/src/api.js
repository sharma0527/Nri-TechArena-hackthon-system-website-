const API_BASE = "https://nri-techarena-hackthon-system-website-3.onrender.com";

export async function apiFetch(endpoint, options = {}, retries = 3) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
    });

    if (!res.ok) {
      throw new Error(`API error ${res.status}`);
    }

    return await res.json();

  } catch (err) {
    if (retries > 0) {
      console.log("Retrying request:", endpoint);
      await new Promise(r => setTimeout(r, 2000));
      return apiFetch(endpoint, options, retries - 1);
    }
    throw err;
  }
}

export default API_BASE;
