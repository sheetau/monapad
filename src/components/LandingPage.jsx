import Head from "next/head";
import Script from "next/script";
import { alternates, locales } from "../site/locales";
import { localizeHtml } from "../site/localizeHtml";
import { bodyTemplate } from "../site/template";

export function LandingPage({ locale }) {
  const content = locales[locale] ?? locales.en;
  const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "/monapad";
  const html = localizeHtml(bodyTemplate, content);

  return (
    <>
      <Head>
        <title>{content.title}</title>
        <meta name="description" content={content.description} />
        <link rel="canonical" href={content.canonical} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=M+PLUS+2:wght@100..900&display=swap"
          as="style"
        />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+2:wght@100..900&display=swap" />
        <link rel="preload" href="https://pvinis.github.io/iosevka-webfont/3.4.1/iosevka.css" as="style" />
        <link rel="stylesheet" href="https://pvinis.github.io/iosevka-webfont/3.4.1/iosevka.css" />
        {Object.entries(alternates).map(([hrefLang, href]) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={content.canonical} />
        <meta property="og:title" content={content.shortTitle} />
        <meta property="og:description" content={content.description} />
        <meta property="og:locale" content={content.ogLocale} />
        <meta property="og:image" content={`${alternates.en}media/ss_onyx.png`} />
        <meta property="og:image:secure_url" content={`${alternates.en}media/ss_onyx.png`} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1125" />
        <meta property="og:image:height" content="672" />
        <meta property="og:image:alt" content="Monapad editor screenshot using the Onyx theme" />
        <meta property="og:site_name" content="Monapad" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.shortTitle} />
        <meta name="twitter:description" content={content.description} />
        <meta name="twitter:image" content={`${alternates.en}media/ss_onyx.png`} />
        <meta name="twitter:image:alt" content="Monapad editor screenshot using the Onyx theme" />
        <link rel="icon" href={`${assetBase}/media/favicon.ico?v=5`} sizes="any" />
        <link rel="shortcut icon" href={`${assetBase}/media/favicon.ico?v=5`} />
        <link rel="icon" type="image/png" sizes="48x48" href={`${assetBase}/media/favicon-48.png?v=5`} />
      </Head>
      {locale === "en" && (
        <Script id="locale-redirect" strategy="beforeInteractive">
          {`
            try {
              if (!localStorage.getItem("monapad-locale")) {
                var prefersJapanese = navigator.languages
                  ? navigator.languages.some(function (language) { return /^ja\\b/i.test(language); })
                  : /^ja\\b/i.test(navigator.language || "");
                if (prefersJapanese && !/\\/ja\\/?$/.test(location.pathname)) {
                  location.replace("${assetBase}/ja/");
                }
              }
            } catch (_) {}
          `}
        </Script>
      )}
      <div className="site-shell" dangerouslySetInnerHTML={{ __html: html }} />
      <Script async src="https://www.googletagmanager.com/gtag/js?id=G-F2LNNGM5B3" />
      <Script id="gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag("js", new Date());
          gtag("config", "G-F2LNNGM5B3");
        `}
      </Script>
      <Script src={`${assetBase}/scripts/site.js`} strategy="afterInteractive" />
      <Script src={`${assetBase}/scripts/hero-particles.js`} strategy="afterInteractive" />
      <Script src={`${assetBase}/scripts/hero-mockup.js`} strategy="afterInteractive" />
    </>
  );
}
