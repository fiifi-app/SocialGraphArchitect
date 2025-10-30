import ContactCard from '../ContactCard';

export default function ContactCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <ContactCard
        id="1"
        fullName="Sarah Johnson"
        role="Investor"
        org="Sequoia Capital"
        geo="San Francisco, CA"
        relationshipStrength={0.85}
        tags={["AI", "Seed Stage", "DevTools"]}
        lastInteractionAt="2025-01-15"
        onEdit={() => console.log('Edit contact')}
      />
      <ContactCard
        id="2"
        fullName="Michael Park"
        role="Founder"
        org="TechFlow AI"
        geo="New York, NY"
        relationshipStrength={0.62}
        tags={["Series A", "Fundraising", "B2B SaaS"]}
        lastInteractionAt="2024-12-28"
        onEdit={() => console.log('Edit contact')}
      />
      <ContactCard
        id="3"
        fullName="Amanda Chen"
        role="GP"
        org="Benchmark"
        geo="Palo Alto, CA"
        relationshipStrength={0.91}
        tags={["Growth Stage", "Fintech", "Enterprise"]}
        lastInteractionAt="2025-01-20"
        onEdit={() => console.log('Edit contact')}
      />
    </div>
  );
}
