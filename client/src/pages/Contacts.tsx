import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContactCard from "@/components/ContactCard";
import { Plus, Search, Upload } from "lucide-react";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");

  const mockContacts = [
    {
      id: "1",
      fullName: "Sarah Johnson",
      role: "Investor",
      org: "Sequoia Capital",
      geo: "San Francisco, CA",
      relationshipStrength: 0.85,
      tags: ["AI", "Seed Stage", "DevTools"],
      lastInteractionAt: "2025-01-15",
    },
    {
      id: "2",
      fullName: "Michael Park",
      role: "Founder",
      org: "TechFlow AI",
      geo: "New York, NY",
      relationshipStrength: 0.62,
      tags: ["Series A", "Fundraising", "B2B SaaS"],
      lastInteractionAt: "2024-12-28",
    },
    {
      id: "3",
      fullName: "Amanda Chen",
      role: "GP",
      org: "Benchmark",
      geo: "Palo Alto, CA",
      relationshipStrength: 0.91,
      tags: ["Growth Stage", "Fintech", "Enterprise"],
      lastInteractionAt: "2025-01-20",
    },
    {
      id: "4",
      fullName: "David Rodriguez",
      role: "LP",
      org: "University Endowment",
      geo: "Boston, MA",
      relationshipStrength: 0.73,
      tags: ["Institutional", "Long-term"],
      lastInteractionAt: "2024-11-30",
    },
    {
      id: "5",
      fullName: "Emma Wilson",
      role: "Operator",
      org: "Scale AI",
      geo: "San Francisco, CA",
      relationshipStrength: 0.58,
      tags: ["ML", "Operations", "Hiring"],
      lastInteractionAt: "2025-01-10",
    },
    {
      id: "6",
      fullName: "James Kim",
      role: "Investor",
      org: "Andreessen Horowitz",
      geo: "Menlo Park, CA",
      relationshipStrength: 0.79,
      tags: ["Crypto", "Web3", "Early Stage"],
      lastInteractionAt: "2025-01-05",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Contacts</h1>
            <p className="text-muted-foreground">
              Manage your network and investment theses
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button data-testid="button-add-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-contacts"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockContacts.map((contact) => (
          <ContactCard
            key={contact.id}
            {...contact}
            onEdit={() => console.log('Edit', contact.fullName)}
          />
        ))}
      </div>
    </div>
  );
}
