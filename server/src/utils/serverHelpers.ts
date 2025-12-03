import { App, SSLApp, type HttpRequest, type HttpResponse, type TemplatedApp } from "uWebSockets.js";
import { Config } from "../config";

export function createServer(): TemplatedApp {
    return Config.ssl
        ? SSLApp({
            key_file_name: Config.ssl.keyFile,
            cert_file_name: Config.ssl.certFile
        })
        : App();
}

/**
 * Apply CORS headers to a response.
 * @param resp The response sent by the server.
 */
export function cors(resp: HttpResponse): void {
    resp.writeHeader("Access-Control-Allow-Origin", "*")
        .writeHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        .writeHeader("Access-Control-Allow-Headers", "origin, content-type, accept, x-requested-with")
        .writeHeader("Access-Control-Max-Age", "3600");
}

export function forbidden(resp: HttpResponse): void {
    resp.writeStatus("403 Forbidden")
        .end("403 Forbidden");
}

export const textDecoder = new TextDecoder();

// export function getIP(res: HttpResponse, req: HttpRequest): string {
//     return (Config.ipHeader && req.getHeader(Config.ipHeader)) || textDecoder.decode(res.getRemoteAddressAsText());
// }


export function getIP(res: HttpResponse, req: HttpRequest): string {
    let ip = Config.ipHeader && req.getHeader(Config.ipHeader);

    // If X-Forwarded-For, parse the FIRST IP (real client)
    if (Config.ipHeader === "x-forwarded-for" && ip) {
        ip = ip.split(",")[0]?.trim() || ip;
    }

    // Validate it's a real IP (optional but recommended)
    if (ip && !ip.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)) {
        ip = undefined;  // Invalid → fallback
    }

    return ip || textDecoder.decode(res.getRemoteAddressAsText()) || "127.0.0.1";
}