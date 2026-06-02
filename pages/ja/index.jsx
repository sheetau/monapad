import { LandingPage } from "../../src/components/LandingPage";

export default function JapaneseHomePage() {
  return <LandingPage locale="ja" />;
}

export function getStaticProps() {
  return { props: { locale: "ja" } };
}
