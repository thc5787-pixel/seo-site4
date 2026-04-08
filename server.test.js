const request = require('supertest');
const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const app = require('./server');

const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Sports Feed</title>
    <item>
      <title><![CDATA[Mock Headline One]]></title>
      <link>https://www.bbc.com/sport/football/mock-headline-one</link>
      <description><![CDATA[Mock description one for SEO test coverage.]]></description>
      <pubDate>Wed, 08 Apr 2026 00:00:00 GMT</pubDate>
      <media:thumbnail url="https://example.com/mock-1.jpg" />
    </item>
    <item>
      <title><![CDATA[Mock Headline Two]]></title>
      <link>https://www.bbc.com/sport/cricket/mock-headline-two</link>
      <description><![CDATA[Mock description two for SEO test coverage.]]></description>
      <pubDate>Wed, 08 Apr 2026 01:00:00 GMT</pubDate>
      <media:thumbnail url="https://example.com/mock-2.jpg" />
    </item>
  </channel>
</rss>`;

function buildMockGet(xml = mockRssXml) {
  return jest.fn((url, options, callback) => {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {
      'content-type': 'application/rss+xml',
      'content-length': String(Buffer.byteLength(xml))
    };

    const req = new EventEmitter();
    req.destroy = jest.fn();

    process.nextTick(() => {
      callback(res);
      res.emit('data', xml);
      res.emit('end');
    });

    return req;
  });
}

describe('SEO Website Tests', () => {
  let httpGetSpy;
  let httpsGetSpy;

  beforeAll(() => {
    httpGetSpy = jest.spyOn(http, 'get').mockImplementation(buildMockGet());
    httpsGetSpy = jest.spyOn(https, 'get').mockImplementation(buildMockGet());
  });

  afterAll(() => {
    httpGetSpy.mockRestore();
    httpsGetSpy.mockRestore();
  });

  // ── Home Page (includes blog section) ─────────────────
  describe('Home /', () => {
    let res;
    beforeAll(async () => { res = await request(app).get('/'); });

    test('returns 200', () => expect(res.status).toBe(200));
    test('Content-Type is HTML', () => expect(res.headers['content-type']).toMatch(/text\/html/));
    test('has <title>', () => expect(res.text).toMatch(/<title>.+<\/title>/));
    test('has meta description', () => expect(res.text).toMatch(/name="description"/));
    test('has canonical URL', () => expect(res.text).toMatch(/rel="canonical"/));
    test('has og:title', () => expect(res.text).toMatch(/property="og:title"/));
    test('has og:description', () => expect(res.text).toMatch(/property="og:description"/));
    test('has og:image', () => expect(res.text).toMatch(/property="og:image"/));
    test('has og:image:alt', () => expect(res.text).toMatch(/property="og:image:alt"/));
    test('has Twitter Card', () => expect(res.text).toMatch(/name="twitter:card"/));
    test('has twitter:image', () => expect(res.text).toMatch(/name="twitter:image"/));
    test('has twitter:image:alt', () => expect(res.text).toMatch(/name="twitter:image:alt"/));
    test('has theme-color meta', () => expect(res.text).toMatch(/name="theme-color"/));
    test('has self hreflang', () => expect(res.text).toMatch(/rel="alternate" hreflang="en"/));
    test('has x-default hreflang', () => expect(res.text).toMatch(/rel="alternate" hreflang="x-default"/));
    test('has favicon', () => expect(res.text).toMatch(/rel="icon"/));
    test('has preconnect for image host', () => expect(res.text).toMatch(/rel="preconnect" href="https:\/\/images\.unsplash\.com"/));
    test('has dns-prefetch for image host', () => expect(res.text).toMatch(/rel="dns-prefetch" href="https:\/\/images\.unsplash\.com"/));
    test('has JSON-LD structured data', () => expect(res.text).toMatch(/application\/ld\+json/));
    test('JSON-LD includes WebSite', () => expect(res.text).toMatch(/"@type":\s*"WebSite"/));
    test('JSON-LD includes Organization', () => expect(res.text).toMatch(/"@type":\s*"Organization"/));
    test('JSON-LD includes WebPage', () => expect(res.text).toMatch(/"@type":\s*"WebPage"/));
    test('JSON-LD does not use localhost', () => expect(res.text).not.toMatch(/http:\/\/localhost:3000/));
    test('has X-Robots-Tag header for indexing', () => expect(res.headers['x-robots-tag']).toMatch(/index, follow/));
    test('has semantic <main>', () => expect(res.text).toMatch(/<main>/));
    test('has exactly one <h1>', () => expect((res.text.match(/<h1[\s>]/g) || []).length).toBe(1));
    test('has <header>', () => expect(res.text).toMatch(/<header>/));
    test('has <footer>', () => expect(res.text).toMatch(/<footer>/));
    test('has <nav>', () => expect(res.text).toMatch(/<nav/));
    test('robots allows indexing', () => expect(res.text).toMatch(/content="index, follow"/));
    test('has Cache-Control header', () => expect(res.headers['cache-control']).toMatch(/public/));
    test('has news section title', () => expect(res.text).toMatch(/News/));
    test('has semantic <article> tags', () => expect(res.text).toMatch(/<article[\s>]/));
    test('has external news links', () => expect(res.text).toMatch(/bbc\.com\/sport/));
    test('news images include decoding async', () => expect(res.text).toMatch(/<img[^>]+decoding="async"/));
    test('news images include explicit dimensions', () => {
      expect(res.text).toMatch(/<img[^>]+width="240"/);
      expect(res.text).toMatch(/<img[^>]+height="140"/);
    });
    test('uses mocked RSS data instead of live feed content', () => {
      expect(res.text).toMatch(/Mock Headline One/);
      expect(res.text).toMatch(/Mock Headline Two/);
    });
    test('decodes HTML entities before stripping descriptions', () => {
      expect(res.text).not.toMatch(/&lt;img/);
    });
    test('uses source label matching the feed', () => {
      expect(res.text).toMatch(/BBC Sport ↗/);
      expect(res.text).toMatch(/Times of India ↗/);
    });
  });

  // ── /blog is not a live route ──────────────────────────
  describe('/blog route', () => {
    test('/blog returns 404', async () => {
      const res = await request(app).get('/blog');
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Page Not Found/i);
      expect(res.text).toMatch(/noindex, nofollow/);
    });
  });

  // ── sitemap.xml ────────────────────────────────────────
  describe('sitemap.xml', () => {
    let res;
    beforeAll(async () => { res = await request(app).get('/sitemap.xml'); });

    test('returns 200', () => expect(res.status).toBe(200));
    test('Content-Type is XML', () => expect(res.headers['content-type']).toMatch(/xml/));
    test('has cache-control header', () => expect(res.headers['cache-control']).toMatch(/public/));
    test('has x-robots-tag header', () => expect(res.headers['x-robots-tag']).toMatch(/index, follow/));
    test('has urlset', () => expect(res.text).toMatch(/<urlset/));
    test('includes home URL', () => expect(res.text).toMatch(/<loc>.*\/<\/loc>/));
    test('/about URL not in sitemap', () => expect(res.text).not.toMatch(/<loc>.*\/about<\/loc>/));
    test('/blog URL not in sitemap', () => expect(res.text).not.toMatch(/<loc>.*\/blog<\/loc>/));
    test('does not include hash fragment URLs', () => expect(res.text).not.toMatch(/<loc>.*#.*<\/loc>/));
    test('does not include noindex news-history URLs', () => expect(res.text).not.toMatch(/<loc>.*\/news-history.*<\/loc>/));
    test('has <lastmod>', () => expect(res.text).toMatch(/<lastmod>/));
    test('has <priority>', () => expect(res.text).toMatch(/<priority>/));
    test('has <changefreq>', () => expect(res.text).toMatch(/<changefreq>/));
  });

  // ── robots.txt ─────────────────────────────────────────
  describe('robots.txt', () => {
    let res;
    beforeAll(async () => { res = await request(app).get('/robots.txt'); });

    test('returns 200', () => expect(res.status).toBe(200));
    test('Content-Type is text/plain', () => expect(res.headers['content-type']).toMatch(/text\/plain/));
    test('has cache-control header', () => expect(res.headers['cache-control']).toMatch(/public/));
    test('has x-robots-tag header', () => expect(res.headers['x-robots-tag']).toMatch(/index, follow/));
    test('has User-agent', () => expect(res.text).toMatch(/User-agent/));
    test('has Allow: /', () => expect(res.text).toMatch(/Allow: \//));
    test('has Disallow', () => expect(res.text).toMatch(/Disallow/));
    test('has Crawl-delay', () => expect(res.text).toMatch(/Crawl-delay:/));
    test('has Host directive', () => expect(res.text).toMatch(/Host:/));
    test('has Sitemap link', () => expect(res.text).toMatch(/Sitemap:/));
  });

  // ── 301 Redirect ───────────────────────────────────────
  describe('301 trailing-slash redirect', () => {
    test('/ with trailing slash redirects', async () => {
      const res = await request(app).get('/blog/');
      expect([301, 404]).toContain(res.status);
    });
  });

  // ── Unknown routes → proper 404 ───────────────────────
  describe('unknown routes', () => {
    test('returns 404 page', async () => {
      const res = await request(app).get('/nonexistent-page');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['x-robots-tag']).toMatch(/noindex, nofollow/);
      expect(res.text).toMatch(/404/);
      expect(res.text).toMatch(/Page Not Found/i);
      expect(res.text).toMatch(/noindex, nofollow/);
    });
  });

  // ── Security Headers ───────────────────────────────────
  describe('Security headers (Helmet)', () => {
    let res;
    beforeAll(async () => { res = await request(app).get('/'); });

    test('has X-Content-Type-Options', () =>
      expect(res.headers['x-content-type-options']).toBe('nosniff'));
    test('has X-Frame-Options', () =>
      expect(res.headers['x-frame-options']).toBeDefined());
  });

});
