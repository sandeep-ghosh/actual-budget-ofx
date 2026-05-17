import net from "net";
const DEFAULT_ALLOWED_HOSTS = new Set(["localhost"]);
function parseAllowedHosts() {
    return (process.env.ACTUAL_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
}
function isPrivateIpv4(hostname) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 ||
        parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }
    const [first, second] = parts;
    return (first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168));
}
function isSingleLabelHostname(hostname) {
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname);
}
function isAllowedHostname(hostname) {
    const normalizedHostname = hostname.toLowerCase();
    const configuredAllowedHosts = parseAllowedHosts();
    if (configuredAllowedHosts.length > 0) {
        return configuredAllowedHosts.includes(normalizedHostname);
    }
    if (DEFAULT_ALLOWED_HOSTS.has(normalizedHostname)) {
        return true;
    }
    if (net.isIPv4(normalizedHostname)) {
        return isPrivateIpv4(normalizedHostname);
    }
    // Allow private DNS names commonly used on Docker, LAN, and Tailscale.
    return (isSingleLabelHostname(normalizedHostname) ||
        normalizedHostname.endsWith(".local") ||
        normalizedHostname.endsWith(".lan") ||
        normalizedHostname.endsWith(".internal") ||
        normalizedHostname.endsWith(".ts.net"));
}
export function validateAndNormalizeServerUrl(rawServerUrl) {
    let parsedUrl;
    try {
        parsedUrl = new URL(rawServerUrl.trim());
    }
    catch {
        throw new Error("Actual server URL must be a valid URL");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Actual server URL must use http or https");
    }
    if (parsedUrl.username || parsedUrl.password) {
        throw new Error("Actual server URL must not include credentials");
    }
    if (!parsedUrl.hostname || !isAllowedHostname(parsedUrl.hostname)) {
        throw new Error("Actual server URL host is not allowed. Set ACTUAL_ALLOWED_HOSTS to permit a specific host.");
    }
    parsedUrl.hash = "";
    parsedUrl.search = "";
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";
    return parsedUrl.toString().replace(/\/$/, "");
}
//# sourceMappingURL=server-url.js.map