import { Head, Html, Main, NextScript } from "next/document";

export default function Document(props) {
  const locale = props.__NEXT_DATA__?.props?.pageProps?.locale ?? "en";

  return (
    <Html lang={locale}>
      <Head>
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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
