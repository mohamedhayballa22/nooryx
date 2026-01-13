import HeroSection from "@/components/landing/hero-section";
import AlertingSection from "@/components/landing/alerts";
import AnalyticsSection from "@/components/landing/analytics";
import BentoGridSection from "@/components/landing/bento";
import FinalCTASection from "@/components/landing/final-cta";
import TrustIndicatorSection from "@/components/landing/ledger";
import FinanceSection from "@/components/landing/valuation";


export default function LandingPage() {
  return (
    <> 
      <HeroSection />
      <TrustIndicatorSection />
      <BentoGridSection />
      <AlertingSection />
      <FinanceSection />
      <AnalyticsSection />
      <FinalCTASection />
    </>
  );
}
