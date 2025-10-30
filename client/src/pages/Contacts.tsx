import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContactCard from "@/components/ContactCard";
import { Plus, Search, Upload } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: contacts, isLoading } = useContacts();

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    if (!searchQuery.trim()) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.title?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" data-testid={`skeleton-contact-${i}`} />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4" data-testid="text-no-contacts">
            {searchQuery ? 'No contacts match your search.' : 'No contacts yet. Add your first contact to get started.'}
          </p>
          {!searchQuery && (
            <Button data-testid="button-add-first-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              id={contact.id}
              fullName={contact.name}
              role={contact.title || 'Contact'}
              org={contact.company || undefined}
              geo={undefined}
              relationshipStrength={0.5}
              tags={[]}
              lastInteractionAt={contact.updatedAt.toISOString()}
              onEdit={() => console.log('Edit', contact.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
