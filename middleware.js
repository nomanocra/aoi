const COOKIE_NAME = 'aoi-site-auth';
const SALT = 'aoi-protected-access';

function isLocalRequest(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
}

async function createToken(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getPasswordPage(error = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AOI protected access</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      align-items: center;
      background: #1c2127;
      color: #f6f7f9;
      display: flex;
      font-family: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
      justify-content: center;
      min-height: 100vh;
    }
    .panel {
      background: #252a31;
      border: 1px solid rgb(255 255 255 / 14%);
      border-radius: 2px;
      padding: 32px;
      width: min(100% - 32px, 380px);
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      line-height: 1;
      margin-bottom: 10px;
    }
    p {
      color: #8f99a8;
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 22px;
    }
    .error {
      color: #fa999c;
      font-size: 13px;
      margin-bottom: 14px;
    }
    input {
      background: rgb(0 0 0 / 30%);
      border: 1px solid #5f6b7c;
      border-radius: 2px;
      color: #f6f7f9;
      font-size: 14px;
      height: 36px;
      margin-bottom: 14px;
      outline: none;
      padding: 0 12px;
      width: 100%;
    }
    input:focus { border-color: #00e2be; }
    button {
      background: #00e2be;
      border: 0;
      border-radius: 2px;
      color: #000;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      height: 36px;
      width: 100%;
    }
    button:hover { background: #3affe5; }
  </style>
</head>
<body>
  <main class="panel">
    <h1>Protected access</h1>
    <p>Enter the password to access AOI.</p>
    ${error ? '<div class="error">Incorrect password.</div>' : ''}
    <form method="POST" action="/api/login">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Access</button>
    </form>
  </main>
</body>
</html>`;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (isLocalRequest(url) || url.pathname.startsWith('/api')) {
    return;
  }

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return;
  }

  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));

  if (match) {
    const expectedToken = await createToken(sitePassword);
    if (match[1] === expectedToken) {
      return;
    }
  }

  const error = url.searchParams.get('error') === '1';

  return new Response(getPasswordPage(error), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const config = {
  matcher: ['/((?!api).*)'],
};
