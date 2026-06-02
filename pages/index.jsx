import { LandingPage } from "../src/components/LandingPage";

export default function HomePage() {
  return <LandingPage locale="en" />;
}

export function getStaticProps() {
  return { props: { locale: "en" } };
}
