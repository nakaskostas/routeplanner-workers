// An array of strings that are allowed to be proxied.
const ALLOWED_HOSTS = [
  "api.openrouteservice.org",
  "graphhopper.com",
  "api.maptiler.com",
  "api.open-elevation.com",
];

// Map a service prefix to its real hostname and the secret key it should use.
const SERVICE_MAP = {
  ors: {
    hostname: "api.openrouteservice.org",
    secret: "OPENROUTE_API_KEY",
  },
  gh: {
    hostname: "graphhopper.com",
    secret: "GRAPHHOPPER_KEY",
  },
  maptiler: {
    hostname: "api.maptiler.com",
    secret: "MAPTILER_API_KEY",
  },
  "open-elevation": {
    hostname: "api.open-elevation.com",
    secret: null, // This API doesn't require a key through this proxy
  },
};

/**
 * Handles all incoming requests to the /api/ proxy.
 *
 * @param {object} context - The context object from Cloudflare Functions.
 * @param {Request} context.request - The incoming request.
 * @param {object} context.env - The environment variables (secrets).
 * @param {URL} context.url - The URL of the incoming request.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Extract the service prefix and the rest of the path from the URL.
  // e.g., /api/ors/v2/directions/driving-car/geojson -> [ "ors", "v2/directions/driving-car/geojson" ]
  const pathSegments = url.pathname.replace("/api/", "").split("/");
      const servicePrefix = pathSegments.shift();
      let apiPath = pathSegments.join("/");
  const service = SERVICE_MAP[servicePrefix];

  // If the service is not in our defined map, it's an invalid request.
  if (!service) {
    return new Response("Invalid API service specified.", { status: 400 });
  }

  // --- Fix for GraphHopper which requires /api/1/ prefix ---
  if (servicePrefix === "gh") {
    apiPath = `api/1/${apiPath}`;
  }
  // --- End Fix ---

  // Ensure the target hostname is in our allowlist for security.
  if (!ALLOWED_HOSTS.includes(service.hostname)) {
    return new Response(`Proxying to ${service.hostname} is not allowed.`, {
      status: 403,
    });
  }

  // Construct the new URL to the target API.
  const targetUrl = new URL(`https://${service.hostname}/${apiPath}`);

  // Copy search parameters from the original request to the new URL.
  targetUrl.search = url.search;

  let finalRequest;

  // Handle different API key authentication methods.
  if (service.secret) {
    const secretKey = env[service.secret];

    // --- Enhanced Logging ---
    if (!secretKey) {
      console.error(`SECRET KEY NOT FOUND: The secret named '${service.secret}' was not found in the worker's environment.`);
      return new Response(`API key for ${service.hostname} is not configured.`, {
        status: 500,
      });
    } else {
      console.log(`Secret key '${service.secret}' found successfully.`);
    }
    // --- End Enhanced Logging ---

    if (servicePrefix === "gh" || servicePrefix === "maptiler") {
      // GraphHopper and MapTiler use a 'key' query parameter.
      targetUrl.searchParams.set("key", secretKey);
      finalRequest = new Request(targetUrl, request);
    } else {
      // OpenRouteService uses an 'Authorization' header.
      finalRequest = new Request(targetUrl, request);
      finalRequest.headers.set("Authorization", secretKey);
    }
  } else {
    // For services without a secret, just forward the request.
    finalRequest = new Request(targetUrl, request);
  }

  // Set a more specific User-Agent.
  finalRequest.headers.set(
    "User-Agent",
    "Cloudflare-Worker-Proxy (gpsApp/1.0)"
  );

  console.log(`Proxying request to: ${targetUrl.toString()}`);

  try {
    // Make the actual API call.
    const response = await fetch(finalRequest);

    // Create a new response to avoid 'immutable headers' issues.
    // This also allows us to add CORS headers for the browser.
    const newResponse = new Response(response.body, response);

    // Set CORS headers to allow the frontend to access the API response.
    newResponse.headers.set("Access-Control-Allow-Origin", url.origin);
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return newResponse;

  } catch (e) {
    return new Response("Failed to fetch from the upstream API.", {
      status: 502, // Bad Gateway
    });
  }
}
