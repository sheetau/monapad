import { Head, Html, Main, NextScript } from "next/document";

export default function Document(props) {
  const locale = props.__NEXT_DATA__?.props?.pageProps?.locale ?? "en";

  return (
    <Html lang={locale}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
