const assert = require("node:assert/strict");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");
const { fixture } = require("./fixtures/caller-keys.cjs");

// With sharing on and no gateway keys, the line stays in the keys' card
// (the same border and background as a list of keys) and is centred in it.
const TEXT = {
  en: "No gateway keys yet",
  zh: "尚无网关密钥",
  "zh-TW": "尚無閘道金鑰",
  ja: "ゲートウェイキーはまだありません",
  de: "Noch keine Zugangsschlüssel",
};
const CANCEL = { en: "Cancel", zh: "取消", "zh-TW": "取消", ja: "キャンセル", de: "Abbrechen" };

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const locale of ["en", "zh", "zh-TW", "ja", "de"]) {
    for (const width of [1000, 390]) {
      test(`${engine} ${locale} ${width}: no gateway keys is centred in the card`, async (t) => {
        const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
        t.after(() => browser.close());
        const page = await (await browser.newContext({ viewport: { width, height: 760 }, reducedMotion: "reduce" })).newPage();
        page.setDefaultTimeout(6000);
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", fixture(locale, "light", [], { lan: true, noKeys: true }));
        await page.goto("http://magpie.test/?view=gateway");
        const empty = page.locator("#gatewayKeys .accts > .none");
        await empty.waitFor();
        assert.equal(await empty.textContent(), TEXT[locale]);
        if (locale !== "en") assert.notEqual(await empty.textContent(), TEXT.en);
        assert.equal(await page.locator("#gatewayKeys .accts").count(), 1);
        assert.equal(await page.locator("#gatewayKeys .none").count(), 1);

        const look = await empty.evaluate((el) => {
          const cs = getComputedStyle(el);
          const card = el.parentElement;
          const cardCs = getComputedStyle(card);
          const probe = document.createElement("span");
          probe.style.color = "var(--muted)";
          probe.style.background = "var(--card)";
          probe.style.borderColor = "var(--line)";
          document.body.append(probe);
          const ps = getComputedStyle(probe);
          const muted = ps.color, cardBg = ps.backgroundColor, line = ps.borderTopColor;
          probe.remove();
          const cr = card.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const tr = range.getBoundingClientRect();
          return {
            color: cs.color, muted,
            padTop: parseFloat(cs.paddingTop), padBottom: parseFloat(cs.paddingBottom),
            padLeft: parseFloat(cs.paddingLeft), padRight: parseFloat(cs.paddingRight),
            align: cs.textAlign,
            cardBg: cardCs.backgroundColor, wantBg: cardBg,
            borderW: cardCs.borderTopWidth, borderS: cardCs.borderTopStyle, borderC: cardCs.borderTopColor, wantLine: line,
            radius: cardCs.borderRadius,
            dx: Math.abs((tr.left + tr.right) / 2 - (cr.left + cr.right) / 2),
            dy: Math.abs((tr.top + tr.bottom) / 2 - (cr.top + cr.bottom) / 2),
          };
        });
        assert.equal(look.color, look.muted);
        assert.equal(look.align, "center");
        assert.equal(look.padTop, 12);
        assert.equal(look.padBottom, 12);
        assert.equal(look.padLeft, 16);
        assert.equal(look.padRight, 16);
        assert.equal(look.cardBg, look.wantBg);
        assert.equal(look.borderW, "1px");
        assert.equal(look.borderS, "solid");
        assert.equal(look.borderC, look.wantLine);
        assert.equal(look.radius, "10px");
        assert.ok(look.dx < 2 && look.dy < 2, JSON.stringify(look));
        const fits = await empty.evaluate((el) => {
          const card = el.parentElement;
          return card.scrollWidth <= card.clientWidth + 1 && card.getBoundingClientRect().right <= document.documentElement.clientWidth + 1;
        });
        assert.equal(fits, true);

        const y = await page.evaluate(() => scrollY);
        await page.locator("#addGatewayKey").click();
        await page.locator("#gatewayKeys .accts .acc.adding").waitFor();
        assert.equal(await page.locator("#gatewayKeys .none").count(), 0);
        assert.equal(await page.evaluate(() => scrollY), y);
        await page.locator("#gatewayKeys .adding").getByRole("button", { name: CANCEL[locale], exact: true }).click();
        await empty.waitFor();
        assert.equal(await page.locator("#gatewayKeys .accts").count(), 1);
        assert.equal(await page.evaluate(() => scrollY), y);
        assert.deepEqual(errors, []);
      });
    }
  }
}
