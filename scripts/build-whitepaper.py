#!/usr/bin/env python3
"""Build public/whitepaper.html from docs/whitepaper/*.md.

Static page: no scripts (fits the strict CSP), self-hosted fonts, print stylesheet for "Save as PDF".
The whitepaper text is reproduced verbatim; only presentation (numbering, table colouring,
allocation bars that restate the table figures) is added here.
Run: python3 scripts/build-whitepaper.py
"""
import re, html, pathlib
import markdown
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/whitepaper/RATTERY-SEASON-1-WHITEPAPER-v0.1-beta-EN.md'
OUT = ROOT / 'public/whitepaper.html'
EXPLORER = 'https://robinhoodchain.blockscout.com/token/'
NEST = {'NVDA': ('#91cf36', 'A'), 'AAPL': ('#dce6f0', 'B'), 'AMZN': ('#ffae43', 'C')}
ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX']

md = SRC.read_text(encoding='utf-8')
title_line, rest = md.split('\n', 1)
version_line = rest.strip().split('\n', 1)[0]
body_md = rest.strip().split('\n', 1)[1]
body = markdown.markdown(body_md, extensions=['tables'])
soup = BeautifulSoup(body, 'html.parser')

def slug(t): return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')

# Sections: wrap each h2 and its following siblings.
toc, sections, cur = [], [], None
for node in list(soup.contents):
    if getattr(node, 'name', None) == 'h2':
        n = len(toc); text = node.get_text(); sid = slug(text)
        toc.append((sid, text, ROMAN[n]))
        cur = soup.new_tag('section', attrs={'class': 'wp-section', 'id': sid, 'aria-labelledby': sid + '-h'})
        node['id'] = sid + '-h'
        num = soup.new_tag('span', attrs={'class': 'wp-num', 'aria-hidden': 'true'}); num.string = ROMAN[n]
        node.insert(0, num)
        node.wrap(cur); sections.append(cur)
    elif cur is not None:
        cur.append(node.extract())

signed = re.compile(r'^([+-])\s?\d')
for table in soup.find_all('table'):
    wrap = soup.new_tag('div', attrs={'class': 'wp-table', 'role': 'region', 'tabindex': '0',
                                      'aria-label': table.find('th').get_text() + ' table'})
    table.wrap(wrap)
    for td in table.find_all('td'):
        t = td.get_text().strip()
        m = signed.match(t)
        if m: td['class'] = 'is-up' if m.group(1) == '+' else 'is-down'
        elif t.startswith('0 points'): td['class'] = 'is-flat'
        elif t.startswith('USD '): td['class'] = 'is-price'
        if t in ('Happy', 'Neutral', 'Stressed'): td['class'] = 'is-mood is-' + t.lower()

# Allocation bars restating the published figures.
def bar(label, parts):
    d = soup.new_tag('figure', attrs={'class': 'wp-bar'})
    cap = soup.new_tag('figcaption'); cap.string = label; d.append(cap)
    track = soup.new_tag('div', attrs={'class': 'wp-bar-track', 'role': 'img',
                                       'aria-label': label + ': ' + ', '.join(f'{n} {p}%' for n, p, _ in parts)})
    for name, pct, cls in parts:
        seg = soup.new_tag('span', attrs={'class': 'wp-seg ' + cls, 'style': f'flex:{pct}'})
        b = soup.new_tag('b'); b.string = f'{pct}%'; seg.append(b)
        s = soup.new_tag('small'); s.string = name; seg.append(s)
        track.append(seg)
    d.append(track); return d

fee = next(w for w in soup.select('.wp-table') if 'Weekly fee allocation' in w.get_text())
fee.insert_after(bar('Weekly fee allocation', [('Prizes', 70, 'is-gold'), ('Buyback and burn', 15, 'is-ember'), ('Infrastructure, team and marketing', 15, 'is-stone')]))
split = next(p for p in soup.find_all('p') if p.get_text().startswith('Fresh prize funding is divided'))
split.insert_after(bar('Fresh prize funding', [('Active participants of the winning nest', 80, 'is-gold'), ('Eligible passive holders', 20, 'is-sage')]))

# Formulas: paragraphs that are only inline code.
for p in soup.find_all('p'):
    kids = [c for c in p.contents if not (isinstance(c, str) and not c.strip())]
    if len(kids) == 1 and getattr(kids[0], 'name', None) == 'code':
        p['class'] = 'wp-formula'
    if p.get_text().startswith('Operational status at opening.'):
        p['class'] = 'wp-callout'

# Reward assets with nest colour chips and explorer links.
for li in soup.find_all('li'):
    m = re.match(r'^(\w+) (NVDA|AAPL|AMZN): (0x[0-9a-fA-F]{40})$', li.get_text().strip())
    if m:
        name, tick, addr = m.groups(); color, letter = NEST[tick]
        li.clear(); li['class'] = 'wp-asset'; li['style'] = f'--c:{color}'
        li.append(BeautifulSoup(
            f'<span class="wp-nest" aria-hidden="true">{letter}</span><span class="wp-asset-name">{name} <em>{tick}</em></span>'
            f'<a href="{EXPLORER}{addr}" target="_blank" rel="noopener noreferrer"><code>{addr}</code><span aria-hidden="true"> ↗</span></a>', 'html.parser'))
# Plain URLs in the references list become links.
for li in soup.find_all('li'):
    t = li.get_text()
    m = re.match(r'^(.*?): (https://\S+)$', t)
    if m and not li.find('a'):
        label, url = m.groups(); li.clear(); li['class'] = 'wp-ref'
        li.append(BeautifulSoup(f'<a href="{url}" target="_blank" rel="noopener noreferrer"><span>{html.escape(label)}</span><small>{html.escape(url.replace("https://", ""))}</small><i aria-hidden="true">↗</i></a>', 'html.parser'))

toc_html = '\n'.join(f'<li><a href="#{sid}"><span>{r}</span>{html.escape(t)}</a></li>' for sid, t, r in toc)
flourish = '<svg class="wp-flourish{c}" viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8h38"/><path d="M40 8c6 0 8-6 13-6 4 0 6 3 6 6s-2 6-6 6c-3 0-5-2-5-4"/><path d="M44 8l4-4 4 4-4 4z" class="gem"/><circle cx="6" cy="8" r="1.6" class="gem"/></svg>'
ver, date = [s.strip() for s in version_line.split('|')]

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season I Whitepaper · RATTERY</title>
<meta name="description" content="RATTERY Season 1 whitepaper, {ver.lower()} beta: weekly nest competition on Robinhood Chain, paid actions, stock effects, prizes and holder rewards.">
<link rel="canonical" href="https://rattery.tech/whitepaper">
<meta property="og:type" content="article">
<meta property="og:url" content="https://rattery.tech/whitepaper">
<meta property="og:title" content="RATTERY Season I Whitepaper">
<meta property="og:description" content="Weekly nest competition, paid actions, stock effects, prizes and holder rewards.">
<meta property="og:image" content="https://rattery.tech/rattery-social-v2.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@ratterytech">
<meta name="theme-color" content="#0f100e">
<link rel="icon" type="image/png" href="/rattery-logo.png">
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
:root{{--bg:#0f100e;--bg2:#161612;--panel:#1b1a15;--line:#e8c36a2e;--line2:#ffffff14;--ink:#f3ecd9;--ink2:#cfc6ae;--muted:#9a917b;
 --gold:#e8c36a;--gold-hi:#fff1bf;--gold-lo:#a9782c;--up:#9ad36a;--down:#ef8a6a;--sage:#8fb8a0;--ember:#e0874a;color-scheme:dark}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:84px;-webkit-text-size-adjust:100%}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 "Fraunces",Georgia,serif;
 background-image:radial-gradient(1200px 520px at 50% -120px,#e8c36a1c,transparent 70%),radial-gradient(900px 600px at 100% 30%,#2c3a2a33,transparent 70%)}}
a{{color:var(--gold);text-decoration-color:#e8c36a66;text-underline-offset:3px}}
a:hover{{color:var(--gold-hi)}}
:focus-visible{{outline:2px solid var(--gold);outline-offset:3px;border-radius:4px}}
.skip{{position:absolute;left:-9999px}}.skip:focus{{left:16px;top:12px;z-index:9;background:var(--panel);padding:8px 12px}}
.mono,.wp-kicker,th,code,.wp-chip,.wp-toc,.wp-bar,.wp-top{{font-family:"IBM Plex Mono",ui-monospace,monospace}}

.wp-top{{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px max(16px,calc(50% - 600px));
 background:#0f100ed9;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line2);font-size:12px;letter-spacing:.14em;text-transform:uppercase}}
.wp-brand{{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:600;letter-spacing:.28em}}
.wp-brand img{{width:26px;height:26px;border-radius:6px}}
.wp-back{{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;color:var(--gold);text-decoration:none;background:#e8c36a0d}}
.wp-back:hover{{background:#e8c36a1f}}

.wp-hero{{max-width:1200px;margin:0 auto;padding:64px 16px 36px;text-align:center}}
.wp-kicker{{display:block;font-size:11px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:#cdb98a}}
.wp-title{{display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0 6px}}
.wp-title h1{{margin:0;font:700 clamp(46px,9vw,92px)/1 "Cinzel Decorative","Fraunces",Georgia,serif;letter-spacing:.02em;
 background:linear-gradient(180deg,var(--gold-hi) 0%,var(--gold) 45%,var(--gold-lo) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
 filter:drop-shadow(0 3px 0 #3a2a0e) drop-shadow(0 0 26px #e8c36a38)}}
.wp-title h1 span{{font-size:1.18em}}
.wp-flourish{{width:clamp(44px,8vw,96px);height:24px;fill:none;stroke:var(--gold);stroke-width:1.3;stroke-linecap:round}}.wp-flourish .gem{{fill:var(--gold);stroke:none}}.wp-flourish.flip{{transform:scaleX(-1)}}
.wp-sub{{margin:4px 0 20px;font-style:italic;font-size:clamp(20px,3vw,26px);color:#e6dcc2}}
.wp-chips{{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}}
.wp-chip{{padding:5px 12px;border:1px solid #e8c36a55;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}}
.wp-chip.is-beta{{background:#e8c36a1a}}
.wp-status{{max-width:760px;margin:26px auto 0;padding:12px 16px;border:1px solid #9ad36a40;border-radius:10px;background:#9ad36a0f;color:var(--ink2);font-size:15px;line-height:1.55}}
.wp-status b{{color:var(--up);font-weight:600}}

.wp-glance{{max-width:1200px;margin:0 auto;padding:0 16px 40px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}}
.wp-glance div{{position:relative;padding:18px 16px 16px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,#1d1b15,#141512)}}
.wp-glance small{{display:block;font:600 10px/1.4 "IBM Plex Mono",monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}}
.wp-glance strong{{display:block;margin:6px 0 2px;font-size:22px;line-height:1.2;font-weight:600;color:var(--gold-hi)}}
.wp-glance span{{font-size:14px;color:var(--ink2);line-height:1.45;display:block}}

.wp-layout{{max-width:1200px;margin:0 auto;padding:0 16px 80px;display:grid;grid-template-columns:260px minmax(0,1fr);gap:48px;align-items:start}}
.wp-toc{{position:sticky;top:84px;max-height:calc(100vh - 110px);overflow:auto;font-size:12.5px;line-height:1.4}}
.wp-toc-h,.wp-toc summary{{list-style:none;margin:0 0 10px;font-size:10px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:#cdb98a}}
.wp-toc summary::-webkit-details-marker{{display:none}}
.wp-toc.is-drop{{display:none}}
.wp-toc ol{{margin:0;padding:0;list-style:none;border-left:1px solid var(--line)}}
.wp-toc a{{display:flex;gap:10px;padding:6px 10px 6px 14px;margin-left:-1px;border-left:1px solid transparent;color:var(--ink2);text-decoration:none}}
.wp-toc a span{{min-width:34px;color:var(--gold);opacity:.75;font:600 12px/1.4 "Fraunces",Georgia,serif;letter-spacing:.06em}}
.wp-toc a:hover{{color:var(--gold-hi);border-left-color:var(--gold);background:#e8c36a0a}}

.wp-doc{{max-width:780px}}
.wp-section{{padding:8px 0 28px;border-bottom:1px solid var(--line2);margin-bottom:28px}}
.wp-section:last-child{{border-bottom:0}}
.wp-section h2{{display:flex;align-items:baseline;gap:14px;margin:0 0 14px;font-size:clamp(26px,3.4vw,32px);line-height:1.2;font-weight:600;color:var(--ink)}}
.wp-num{{font:600 .56em/1 "Fraunces",Georgia,serif;color:var(--gold);min-width:2.6em;letter-spacing:.08em;font-variant-numeric:lining-nums}}
.wp-section p{{margin:0 0 16px;color:var(--ink2)}}
.wp-section p strong{{color:var(--ink)}}
.wp-section:first-of-type > p:first-of-type{{font-size:20px;line-height:1.6;color:var(--ink)}}
.wp-section:first-of-type > p:first-of-type::first-letter{{float:left;margin:6px 10px 0 0;font:700 64px/.8 "Cinzel Decorative",serif;color:var(--gold)}}
code{{font-size:.84em;padding:2px 6px;border-radius:5px;background:#ffffff0d;border:1px solid var(--line2);color:var(--gold-hi);word-break:break-all}}

.wp-table{{margin:6px 0 22px;overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#12130f}}
table{{width:100%;border-collapse:collapse;font-size:15px;line-height:1.45}}
th{{padding:12px 14px;text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);background:#e8c36a12;border-bottom:1px solid var(--line);vertical-align:bottom}}
td{{padding:11px 14px;border-bottom:1px solid var(--line2);color:var(--ink2);vertical-align:top}}
tr:last-child td{{border-bottom:0}}
tbody tr:hover td{{background:#ffffff05}}
td:first-child{{color:var(--ink)}}
td.is-up{{color:var(--up);font-weight:600}}td.is-down{{color:var(--down);font-weight:600}}td.is-flat{{color:var(--muted)}}
td.is-price{{font-family:"IBM Plex Mono",monospace;color:var(--gold-hi);white-space:nowrap}}
td.is-mood{{font-weight:600}}td.is-happy{{color:var(--up)}}td.is-neutral{{color:var(--ink)}}td.is-stressed{{color:var(--down)}}

.wp-formula{{margin:8px 0 14px!important;padding:16px 18px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:10px;background:linear-gradient(90deg,#e8c36a12,transparent)}}
.wp-formula code{{display:block;padding:0;border:0;background:none;font-size:15px;line-height:1.6;word-break:normal;white-space:normal}}
.wp-callout{{padding:14px 16px;border:1px dashed #e8c36a66;border-radius:10px;background:#e8c36a0a;font-size:15.5px}}

.wp-bar{{margin:-6px 0 26px}}
.wp-bar figcaption{{margin-bottom:8px;font-size:10.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}}
.wp-bar-track{{display:flex;gap:3px;min-height:58px}}
.wp-seg{{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:8px 10px;border-radius:8px;overflow:hidden}}
.wp-seg b{{font-size:17px;line-height:1.1}}.wp-seg small{{font-size:10.5px;line-height:1.25;opacity:.85;overflow:hidden;text-overflow:ellipsis}}
.wp-seg.is-gold{{background:linear-gradient(180deg,#e8c36a,#b98a3a);color:#231a08}}
.wp-seg.is-ember{{background:#e0874a2e;border:1px solid #e0874a66;color:#f3c2a0}}
.wp-seg.is-stone{{background:#ffffff0c;border:1px solid #ffffff1f;color:var(--ink2)}}
.wp-seg.is-sage{{background:#8fb8a02a;border:1px solid #8fb8a066;color:#cfe6d8}}

.wp-section ul{{margin:0 0 16px;padding:0;list-style:none}}
.wp-asset{{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;padding:12px 14px;margin-bottom:8px;border:1px solid var(--line2);border-left:3px solid var(--c);border-radius:10px;background:#12130f}}
.wp-nest{{grid-row:span 2;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1.5px solid var(--c);color:var(--c);font:700 15px/1 "Cinzel Decorative",serif}}
.wp-asset-name{{color:var(--ink);font-weight:600}}.wp-asset-name em{{font:500 12px "IBM Plex Mono",monospace;color:var(--c);font-style:normal;margin-left:4px}}
.wp-asset a{{text-decoration:none;min-width:0}}.wp-asset code{{font-size:12.5px;color:var(--ink2)}}
.wp-ref a{{display:grid;grid-template-columns:1fr auto;gap:0 12px;padding:12px 14px;margin-bottom:8px;border:1px solid var(--line2);border-radius:10px;text-decoration:none;background:#12130f}}
.wp-ref a:hover{{border-color:var(--line)}}
.wp-ref span{{color:var(--ink)}}.wp-ref small{{grid-column:1;font:12px "IBM Plex Mono",monospace;color:var(--muted);word-break:break-all}}.wp-ref i{{grid-row:1/3;grid-column:2;align-self:center;font-style:normal;color:var(--gold)}}

.wp-foot{{border-top:1px solid var(--line2);padding:28px 16px 40px;text-align:center;color:var(--muted);font-size:13px;line-height:1.6}}
.wp-foot p{{margin:4px 0}}

@media (max-width:980px){{
 .wp-layout{{grid-template-columns:minmax(0,1fr);gap:8px}}
 .wp-toc.is-side{{display:none}}.wp-toc.is-drop{{display:block}}
 .wp-toc{{position:static;max-height:none;margin-bottom:18px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#141511}}
 .wp-toc summary{{cursor:pointer;margin:0;display:flex;justify-content:space-between}}
 .wp-toc summary::after{{content:"+";font-size:14px;color:var(--gold)}}
 .wp-toc[open] summary::after{{content:"−"}}
 .wp-toc[open] summary{{margin-bottom:10px}}
 .wp-glance{{grid-template-columns:repeat(2,minmax(0,1fr))}}
 .wp-doc{{max-width:none}}
}}
@media (max-width:560px){{
 body{{font-size:16px}}
 .wp-top{{letter-spacing:.08em}}.wp-brand span{{display:none}}
 .wp-hero{{padding-top:40px}}
 .wp-glance{{gap:8px}}.wp-glance div{{padding:14px 12px 12px}}.wp-glance strong{{font-size:19px}}.wp-glance span{{font-size:13px}}
 .wp-section:first-of-type > p:first-of-type{{font-size:18px}}
 table{{font-size:14px}}th,td{{padding:10px 11px}}
 .wp-seg small{{display:none}}
}}
@media print{{
 :root{{--bg:#fff;--ink:#16140e;--ink2:#2b271d;--muted:#5d5645;--gold:#8a6420;--gold-hi:#6d4d14;--line:#8a642055;--line2:#0000001a}}
 body{{background:#fff;font-size:11pt}}
 .wp-top,.wp-toc,.skip,.wp-back{{display:none!important}}
 .wp-layout{{display:block;padding:0}}.wp-doc{{max-width:none}}
 .wp-title h1{{color:#8a6420;-webkit-text-fill-color:#8a6420;background:none;filter:none}}
 .wp-glance div,.wp-table,.wp-asset,.wp-ref a,table{{background:#fff}}
 .wp-section{{break-inside:auto}}.wp-section h2,.wp-table,.wp-bar,.wp-formula{{break-inside:avoid}}
 a{{color:inherit}}
}}
</style>
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="wp-top">
 <a class="wp-brand" href="/"><img src="/rattery-logo.png" alt="" width="26" height="26"><span>RATTERY</span></a>
 <a class="wp-back" href="/"><span aria-hidden="true">←</span> Back to the colony</a>
</header>
<main>
<section class="wp-hero" aria-labelledby="wp-title">
 <span class="wp-kicker">RATTERY · Colony games</span>
 <div class="wp-title">{flourish.format(c='')}<h1 id="wp-title">Season&nbsp;<span>I</span></h1>{flourish.format(c=' flip')}</div>
 <p class="wp-sub">Whitepaper</p>
 <div class="wp-chips"><span class="wp-chip is-beta">{html.escape(ver)} · Beta</span><span class="wp-chip">{html.escape(date)}</span><span class="wp-chip">Robinhood Chain · 4663</span></div>
 <p class="wp-status"><b>Season I opened on Monday, 28 September 2026 at 13:00 and closes at the end of Sunday, 4 October (00:00 on Monday, 5 October), São Paulo time.</b> Whitepaper {html.escape(ver.lower())} (beta), updated on {html.escape(date)}.</p>
</section>
<section class="wp-glance" aria-label="At a glance">
 <div><small>Nests</small><strong>3</strong><span>NVIDIA, Apple and Amazon</span></div>
 <div><small>Season 1 dates</small><strong>28 Sep / 4 Oct</strong><span>Opened Monday 13:00; closes Sunday night at 00:00 Monday, São Paulo time</span></div>
 <div><small>Opening prize</small><strong>1,000 USDC</strong><span>Committed, plus 70% of eligible weekly fees</span></div>
 <div><small>Prize split</small><strong>80 / 20</strong><span>Winning nest participants / eligible holders</span></div>
</section>
<div class="wp-layout">
 <aside class="wp-toc is-side"><p class="wp-toc-h">Contents</p><nav aria-label="Whitepaper sections"><ol>
{toc_html}
 </ol></nav></aside>
 <details class="wp-toc is-drop"><summary>Contents</summary><nav aria-label="Whitepaper sections, compact"><ol>
{toc_html}
 </ol></nav></details>
 <article class="wp-doc" id="content" aria-label="{html.escape(title_line.lstrip('# '))}">
{str(soup)}
 </article>
</div>
</main>
<footer class="wp-foot">
 <p>RATTERY · A digital colony experiment. Simulated behavior, not scientific measurements.</p>
 <p>Nothing on this page is financial advice. Always check contract addresses before transacting.</p>
</footer>
</body>
</html>
'''
OUT.write_text(page, encoding='utf-8')
print('wrote', OUT.relative_to(ROOT), len(page), 'bytes;', len(toc), 'sections')
