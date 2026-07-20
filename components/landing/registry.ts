import Hero from "./Hero";
import WhyChooseUs from "./WhyChooseUs";
import About from "./About";
import Programs from "./Programs";
import SchoolLife from "./SchoolLife";
import Gallery from "./Gallery";
import Achievements from "./Achievements";
import Testimonials from "./Testimonials";
import Principal from "./Principal";
import FAQ from "./FAQ";
import CTA from "./CTA";

export const ComponentRegistry: Record<string, React.ComponentType<any>> = {
  "hero": Hero,
  "why-choose-us": WhyChooseUs,
  "about": About,
  "programs": Programs,
  "school-life": SchoolLife,
  "gallery": Gallery,
  "achievements": Achievements,
  "testimonials": Testimonials,
  "principal": Principal,
  "faq": FAQ,
  "cta": CTA
};
