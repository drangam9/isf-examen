# ISF · Simulator de examen

React + Vite study app for the Conducător exam hosted by ISF, using the 506 questions extracted from the reference PDF dated 16.01.2026.

- **Examen aleatoriu** is the default section. Each exam draws 40 distinct questions from the full bank. Answers are scored and reviewed at the end.
- An optional **40-minute timer** ends the exam automatically. Its fixed deadline survives refreshes and keeps running when another section or browser tab is open. Unanswered questions appear in the final review.
- **Teste în ordinea PDF-ului** preserves the original 13 groups (40 questions each, with 26 in the final group) and immediate answer feedback.
- Both sections save progress in the browser. Existing PDF-order progress is migrated automatically from the previous storage key.
- The footer's **Document de referință** link downloads the original PDF, included automatically in production builds.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

Exam selection, timing, answer submission, and saved-session validation are covered by the dependency-free Node test suite in `src/exam.test.js`.

`npm run extract-questions` rebuilds the question bank from the reference PDF. GitHub Pages builds the site on pushes to `main`; Vite is configured for `/isf-examen/`.

## SEO and indexing

The canonical site URL is `https://drangam9.github.io/isf-examen/`. The HTML includes a Romanian title and description specific to the Conducător exam, canonical and social-sharing metadata, and a JavaScript-disabled explanation. The React page also describes the exam and question bank for visitors. Google can render the interactive React app; other crawlers may only read the initial HTML. Full prerendering remains a possible future improvement.

Vite copies `public/robots.txt` and `public/sitemap.xml` into the production build. The sitemap lists the single public page; exam sessions and the PDF-order groups are browser state, not separate URLs.

**GitHub Pages limitation:** crawlers only use `https://drangam9.github.io/robots.txt`. This project's build serves the file at `/isf-examen/robots.txt`, which does not control crawling. To activate these rules and sitemap discovery, copy `public/robots.txt` into the publishing root of the separate `drangam9.github.io` repository. If a root robots file already exists, preserve its rules and add this project's `Sitemap` line. Without a root robots file, crawling is allowed by default; the file is not required to be indexed. See [Google's robots.txt guide](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt).

After deploying:

1. Add the URL-prefix property `https://drangam9.github.io/isf-examen/` in [Google Search Console](https://search.google.com/search-console/) and complete ownership verification. A provided HTML verification file can be placed in `public/`, or the provided verification meta tag can be added to `index.html`, then deployed.
2. Submit `https://drangam9.github.io/isf-examen/sitemap.xml` in Search Console's Sitemaps report. Direct submission works without a domain-root robots file.
3. Inspect the canonical homepage URL and request indexing. Check that the rendered page and assets load, and review indexing reports after Google processes it. Submission does not guarantee indexing or a particular ranking.
4. If the site moves to a custom domain, update the canonical URL, Open Graph URL, sitemap link, `public/sitemap.xml`, and the sitemap URL in `public/robots.txt` together.

Build verification confirms the files are packaged; live indexing and Search Console verification require the deployed site and the owner's Google account. See [Google's Search Console guide](https://developers.google.com/search/docs/monitor-debug/search-console-start) and [sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
