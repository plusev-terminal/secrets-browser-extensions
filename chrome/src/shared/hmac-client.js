// HMAC-authenticated fetch wrapper for Terminal's External API.
// Mirrors the Go CLI's signing logic and the go-plusev-api-client.
//
// Message format: timestamp + method + path + body
// Headers: X-API-Key, X-Timestamp (Unix seconds), X-Signature (hex HMAC-SHA256)

const enc = new TextEncoder();

export class HmacClient {
  constructor(config) {
    this.baseURL = config.serverURL;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  async sign(method, path, timestamp, body) {
    const message = `${timestamp}${method}${path}${body}`;
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(this.apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));

    return Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async request(method, path, body) {
    const fullPath = `/extapi/secrets/v1${path}`;
    const url = this.baseURL + fullPath;

    const bodyStr = body != null ? JSON.stringify(body) : '';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await this.sign(method, fullPath, timestamp, bodyStr);

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Timestamp': String(timestamp),
        'X-Signature': signature,
      },
      body: bodyStr || undefined,
    });

    const data = await resp.json();

    if (!data.result) {
      const err = new Error(typeof data.data === 'string' ? data.data : 'Request failed');
      err.code = data.code;
      err.response = data;
      throw err;
    }

    return data;
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  get(path) {
    return this.request('GET', path, null);
  }
}
