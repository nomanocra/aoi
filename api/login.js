import { createHash } from 'crypto';

const COOKIE_NAME = 'aoi-site-auth';
const SALT = 'aoi-protected-access';

function isLocalRequest(req) {
  const host = req.headers.host || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { password } = req.body || {};
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || password !== sitePassword) {
    return res.redirect(302, '/?error=1');
  }

  const token = createHash('sha256')
    .update(sitePassword + SALT)
    .digest('hex');

  const secureFlag = isLocalRequest(req) ? '' : '; Secure';

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly${secureFlag}; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`,
  );
  res.redirect(302, '/');
}
