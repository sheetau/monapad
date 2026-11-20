import { Head, Html, Main, NextScript } from "next/document";

export default function Document(props) {
  const locale = props.__NEXT_DATA__?.props?.pageProps?.locale ?? "en";

  return (
    <Html lang={locale}>
      <Head>
        <link rel="preload" href="https://pvinis.github.io/iosevka-webfont/3.4.1/iosevka.css" as="style" />
        <link rel="stylesheet" href="https://pvinis.github.io/iosevka-webfont/3.4.1/iosevka.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
