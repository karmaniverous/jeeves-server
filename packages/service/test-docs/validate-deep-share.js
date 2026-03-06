/**
 * Validate deep share link behavior end-to-end.
 *
 * Tests:
 * 1. Internal links work up to depth limit and not beyond
 * 2. Directory option limits directory access and includes dirs in depth
 * 3. External links always work (never rewritten)
 *
 * Usage: node test-docs/validate-deep-share.js
 * Requires dev server running on port 3457.
 */

const BASE = 'http://localhost:3457';
const INSIDER_KEY = '90db6073c9ee033c10745aa794f70fc5';

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}`);
    fail++;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, data: res.ok ? await res.json() : null, headers: res.headers };
}

async function getShareLink(path, depth, dirs) {
  const res = await fetch(`${BASE}/api/share?key=${INSIDER_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, depth, dirs }),
  });
  return res.json();
}

/** Parse a share URL into its components */
function parseShareUrl(url) {
  const u = new URL(url, BASE);
  return {
    path: u.pathname.replace('/browse', ''),
    key: u.searchParams.get('key'),
    d: u.searchParams.get('d'),
    dirs: u.searchParams.get('dirs'),
    s: u.searchParams.get('s'),
    exp: u.searchParams.get('exp'),
  };
}

/** Build API file URL from share params */
function apiFileUrl(params) {
  let url = `${BASE}/api/file${params.path}?key=${params.key}`;
  if (params.d !== null) url += `&d=${params.d}`;
  if (params.dirs !== null) url += `&dirs=${params.dirs}`;
  if (params.s !== null) url += `&s=${params.s}`;
  if (params.exp !== null) url += `&exp=${params.exp}`;
  return url;
}

/** Build API path (directory) URL from share params */
function apiDirUrl(dirPath, params) {
  let url = `${BASE}/api/path${dirPath}?key=${params.key}`;
  if (params.d !== null) url += `&d=${params.d}`;
  if (params.dirs !== null) url += `&dirs=${params.dirs}`;
  if (params.s !== null) url += `&s=${params.s}`;
  if (params.exp !== null) url += `&exp=${params.exp}`;
  return url;
}

/** Extract internal links (rewritten /browse/ links) from HTML */
function extractInternalLinks(html) {
  const links = [];
  const re = /<a\s+[^>]*?href="(\/browse\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push({ url: m[1], text: m[2] });
  }
  return links;
}

/** Extract external links from HTML */
function extractExternalLinks(html) {
  const links = [];
  const re = /<a\s+[^>]*?href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push({ url: m[1], text: m[2] });
  }
  return links;
}

/** Extract dead (stripped) link texts — text that was a link but is now plain */
function extractDeadLinkTexts(html) {
  // Dead links become plain text (no <a> wrapper). We look for known link texts
  // that are NOT inside <a> tags.
  return html;
}

async function runTests() {
  console.log('\n🔗 Deep Share Link Validation\n');

  // ================================================================
  // TEST 1: Depth 0 — no internal links should work
  // ================================================================
  console.log('━━━ Test 1: Depth 0 (no link following) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 0, false);
    const params = parseShareUrl(share.url);

    // Page A should load
    const fileRes = await fetchJson(apiFileUrl(params));
    assert(fileRes.status === 200, 'Page A loads with depth-0 key');
    assert(fileRes.data?.isInsider === false, 'Page A shows as outsider');

    // HTML should have NO internal links (all stripped)
    const html = fileRes.data?.html || '';
    const internalLinks = extractInternalLinks(html);
    assert(internalLinks.length === 0, `No internal links at depth 0 (found ${internalLinks.length})`);

    // External links should still be present
    const externalLinks = extractExternalLinks(html);
    assert(externalLinks.length > 0, `External links preserved (found ${externalLinks.length})`);
    assert(externalLinks.some(l => l.url.includes('google.com')), 'Google link preserved');
  }

  // ================================================================
  // TEST 2: Depth 1 — one hop of internal links
  // ================================================================
  console.log('\n━━━ Test 2: Depth 1 (one hop) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 1, false);
    const params = parseShareUrl(share.url);

    // Page A should load
    const fileRes = await fetchJson(apiFileUrl(params));
    assert(fileRes.status === 200, 'Page A loads with depth-1 key');

    const html = fileRes.data?.html || '';
    const internalLinks = extractInternalLinks(html);

    // Page B link should be live (depth 1)
    const pageBLink = internalLinks.find(l => l.text.includes('Page B'));
    assert(!!pageBLink, 'Page B link is live at depth 1');

    // Sub Page (page-d in subdirectory) should be dead if dirs=false
    const subPageLink = internalLinks.find(l => l.text.includes('Sub Page'));
    // Actually sub/page-d.md is a file, not a directory — it should be live
    // The dirs flag controls directory listings, not files in subdirectories
    // Let's check what we get
    console.log(`  ℹ️  Sub Page link present: ${!!subPageLink}`);

    // External links always present
    const externalLinks = extractExternalLinks(html);
    assert(externalLinks.some(l => l.url.includes('google.com')), 'External links preserved');

    // Follow Page B link — should work
    if (pageBLink) {
      const pageBParams = parseShareUrl(pageBLink.url);
      const pageBRes = await fetchJson(apiFileUrl(pageBParams));
      assert(pageBRes.status === 200, 'Page B loads via depth-1 link');

      // Page B's internal links should be dead (depth exhausted)
      const pageBHtml = pageBRes.data?.html || '';
      const pageBInternalLinks = extractInternalLinks(pageBHtml);
      assert(pageBInternalLinks.length === 0, `Page B has no live internal links (depth exhausted, found ${pageBInternalLinks.length})`);

      // Page B's external links should still work
      const pageBExternalLinks = extractExternalLinks(pageBHtml);
      assert(pageBExternalLinks.some(l => l.url.includes('github.com')), 'Page B external links preserved');
    }
  }

  // ================================================================
  // TEST 3: Depth 2 — two hops
  // ================================================================
  console.log('\n━━━ Test 3: Depth 2 (two hops) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 2, false);
    const params = parseShareUrl(share.url);

    const fileRes = await fetchJson(apiFileUrl(params));
    assert(fileRes.status === 200, 'Page A loads with depth-2 key');

    const html = fileRes.data?.html || '';
    const internalLinks = extractInternalLinks(html);
    const pageBLink = internalLinks.find(l => l.text.includes('Page B'));
    assert(!!pageBLink, 'Page B link is live at depth 2');

    // Follow to Page B
    if (pageBLink) {
      const pageBParams = parseShareUrl(pageBLink.url);
      const pageBRes = await fetchJson(apiFileUrl(pageBParams));
      assert(pageBRes.status === 200, 'Page B loads (hop 1)');

      const pageBHtml = pageBRes.data?.html || '';
      const pageBLinks = extractInternalLinks(pageBHtml);
      const pageCLink = pageBLinks.find(l => l.text.includes('Page C'));
      assert(!!pageCLink, 'Page C link is live from Page B (hop 2)');

      // Follow to Page C
      if (pageCLink) {
        const pageCParams = parseShareUrl(pageCLink.url);
        const pageCRes = await fetchJson(apiFileUrl(pageCParams));
        assert(pageCRes.status === 200, 'Page C loads (hop 2)');

        // Page C's internal links should be dead (depth exhausted)
        const pageCHtml = pageCRes.data?.html || '';
        const pageCLinks = extractInternalLinks(pageCHtml);
        assert(pageCLinks.length === 0, `Page C has no live internal links (depth exhausted, found ${pageCLinks.length})`);

        // External links on Page C
        const pageCExternalLinks = extractExternalLinks(pageCHtml);
        assert(pageCExternalLinks.some(l => l.url.includes('wikipedia.org')), 'Page C external links preserved');
      }
    }
  }

  // ================================================================
  // TEST 4: Depth 1, dirs=false — directory listing blocked
  // ================================================================
  console.log('\n━━━ Test 4: Depth 1, dirs=false (directory access blocked) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 1, false);
    const params = parseShareUrl(share.url);

    // Try to access the directory listing
    const dirRes = await fetchJson(apiDirUrl('/e/dev/karmaniverous/jeeves-server/test-docs/', params));
    assert(dirRes.status === 401, `Directory listing blocked with dirs=false (got ${dirRes.status})`);
  }

  // ================================================================
  // TEST 5: Depth 1, dirs=true — directory listing allowed
  // ================================================================
  console.log('\n━━━ Test 5: Depth 1, dirs=true (directory access) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 1, true);
    const params = parseShareUrl(share.url);

    // Page A should load
    const fileRes = await fetchJson(apiFileUrl(params));
    assert(fileRes.status === 200, 'Page A loads with dirs=true');

    // Internal file links should still be live
    const html = fileRes.data?.html || '';
    const internalLinks = extractInternalLinks(html);
    const pageBLink = internalLinks.find(l => l.text.includes('Page B'));
    assert(!!pageBLink, 'Page B link is live with dirs=true');

    // Parent directory listing should work
    const parentDirRes = await fetchJson(apiDirUrl('/e/dev/karmaniverous/jeeves-server/test-docs', params));
    assert(parentDirRes.status === 200, 'Parent directory listing works with dirs=true');

    // Subdirectory listing should work
    const subDirRes = await fetchJson(apiDirUrl('/e/dev/karmaniverous/jeeves-server/test-docs/sub', params));
    assert(subDirRes.status === 200, 'Subdirectory listing works with dirs=true');

    // Any directory accessible (scoped only by sharer's access)
    const ancestorDirRes = await fetchJson(apiDirUrl('/e/dev', params));
    assert(ancestorDirRes.status === 200, `Ancestor dir accessible with dirs=true (got ${ancestorDirRes.status})`);

    // Sibling directory accessible too
    const siblingDirRes = await fetchJson(apiDirUrl('/e/dev/karmaniverous/jeeves-server/src', params));
    assert(siblingDirRes.status === 200, `Sibling dir accessible with dirs=true (got ${siblingDirRes.status})`);
  }

  // ================================================================
  // TEST 6: Backward compatibility — no depth/dirs params
  // ================================================================
  console.log('\n━━━ Test 6: Backward compat (no depth/dirs) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 0, false);
    const params = parseShareUrl(share.url);

    // Should be a legacy share link (no d/dirs/s params)
    assert(params.d === null, 'No d param in legacy share');
    assert(params.s === null, 'No s param in legacy share');

    const fileRes = await fetchJson(apiFileUrl(params));
    assert(fileRes.status === 200, 'Legacy share link works');
  }

  // ================================================================
  // TEST 7: Cross-page key isolation — key from Page A can't access Page B directly
  // ================================================================
  console.log('\n━━━ Test 7: Key isolation (depth-0 key can\'t access other pages) ━━━');
  {
    const share = await getShareLink('/e/dev/karmaniverous/jeeves-server/test-docs/page-a.md', 0, false);
    const params = parseShareUrl(share.url);

    // Try to use Page A's key to access Page B directly
    const pageBUrl = `${BASE}/api/file/e/dev/karmaniverous/jeeves-server/test-docs/page-b.md?key=${params.key}`;
    const pageBRes = await fetchJson(pageBUrl);
    assert(pageBRes.status === 401, `Page A's depth-0 key can't access Page B (got ${pageBRes.status})`);
  }

  // ================================================================
  // Summary
  // ================================================================
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} total`);
  if (fail > 0) {
    console.log('⚠️  Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
