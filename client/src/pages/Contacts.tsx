import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ContactCard from "@/components/ContactCard";
import ContactDialog from "@/components/ContactDialog";
import { Plus, Search, Upload, Users, TrendingUp } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'investor' | 'lp'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const CONTACTS_PER_PAGE = 50;
  
  const { data: contacts, isLoading } = useContacts();

  const stats = useMemo(() => {
    if (!contacts) return { total: 0, investors: 0, lps: 0 };
    return {
      total: contacts.length,
      investors: contacts.filter(c => !c.isLp).length,
      lps: contacts.filter(c => c.isLp).length,
    };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    let filtered = contacts;
    
    if (filterType === 'investor') {
      filtered = filtered.filter(c => !c.isLp);
    } else if (filterType === 'lp') {
      filtered = filtered.filter(c => c.isLp);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact => 
        contact.name.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query) ||
        contact.title?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [contacts, searchQuery, filterType]);

  const totalPages = Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * CONTACTS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + CONTACTS_PER_PAGE);
  }, [filteredContacts, currentPage]);

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
            <Button variant="outline" data-testid="button-import-csv" disabled>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button 
              onClick={() => setShowContactDialog(true)}
              data-testid="button-add-contact"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4" data-testid="stat-card-investors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-1/20">
                <TrendingUp className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Investors</p>
                <p className="text-2xl font-semibold" data-testid="text-investor-count">{stats.investors}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-card-lps">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-4/20">
                <Users className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limited Partners</p>
                <p className="text-2xl font-semibold" data-testid="text-lp-count">{stats.lps}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
              data-testid="input-search-contacts"
            />
          </div>
          <Select 
            value={filterType} 
            onValueChange={(value: any) => {
              setFilterType(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" data-testid="select-contact-type">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="investor">Investors Only</SelectItem>
              <SelectItem value="lp">LPs Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredContacts.length > CONTACTS_PER_PAGE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <span data-testid="text-showing-count">
              Showing {((currentPage - 1) * CONTACTS_PER_PAGE) + 1}-{Math.min(currentPage * CONTACTS_PER_PAGE, filteredContacts.length)} of {filteredContacts.length}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" data-testid={`skeleton-contact-${i}`} />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4" data-testid="text-no-contacts">
            {searchQuery || filterType !== 'all' ? 'No contacts match your filters.' : 'No contacts yet. Add your first contact to get started.'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <Button 
              onClick={() => setShowContactDialog(true)}
              data-testid="button-add-first-contact"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Contact
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedContacts.map((contact) => (
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
                linkedinUrl={contact.linkedinUrl || undefined}
                contactType={contact.contactType as 'investor' | 'lp'}
                isLp={contact.isLp}
                checkSizeMin={contact.checkSizeMin || undefined}
                checkSizeMax={contact.checkSizeMax || undefined}
                preferredStages={contact.preferredStages || undefined}
                preferredTeamSizes={contact.preferredTeamSizes || undefined}
                preferredTenure={contact.preferredTenure || undefined}
                isFamilyOffice={contact.isFamilyOffice}
                investmentTypes={contact.investmentTypes || undefined}
                avgCheckSize={contact.avgCheckSize || undefined}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4" data-testid="text-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <ContactDialog
        open={showContactDialog}
        onOpenChange={setShowContactDialog}
      />
    </div>
  );
}
