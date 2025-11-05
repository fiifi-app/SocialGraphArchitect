import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ContactCard from "@/components/ContactCard";
import ContactDialog from "@/components/ContactDialog";
import CsvUploadDialog from "@/components/CsvUploadDialog";
import { Plus, Search, Upload, Users } from "lucide-react";
import { useContacts, useContactsCount } from "@/hooks/useContacts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showCsvUploadDialog, setShowCsvUploadDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const CONTACTS_PER_PAGE = 50;
  
  const { data: contacts, isLoading } = useContacts();
  const { data: totalCount } = useContactsCount();

  const stats = useMemo(() => {
    return {
      total: totalCount || 0,
    };
  }, [totalCount]);

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
            <Button 
              variant="outline" 
              onClick={() => setShowCsvUploadDialog(true)}
              data-testid="button-import-csv"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button 
              onClick={() => {
                setEditingContact(null);
                setShowContactDialog(true);
              }}
              data-testid="button-add-contact"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <Card className="p-4 mb-6" data-testid="stat-card-total">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-chart-1/20">
              <Users className="w-5 h-5 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-semibold" data-testid="text-total-count">{stats.total}</p>
            </div>
          </div>
        </Card>

        <div className="relative mb-6">
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
            {searchQuery ? 'No contacts match your search.' : 'No contacts yet. Add your first contact to get started.'}
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => {
                setEditingContact(null);
                setShowContactDialog(true);
              }}
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
                firstName={contact.firstName || undefined}
                lastName={contact.lastName || undefined}
                role={contact.title || 'Contact'}
                org={contact.company || undefined}
                email={contact.email || undefined}
                linkedinUrl={contact.linkedinUrl || undefined}
                location={contact.location || undefined}
                phone={contact.phone || undefined}
                category={contact.category || undefined}
                twitter={contact.twitter || undefined}
                angellist={contact.angellist || undefined}
                companyAddress={contact.companyAddress || undefined}
                companyEmployees={contact.companyEmployees || undefined}
                companyFounded={contact.companyFounded || undefined}
                companyUrl={contact.companyUrl || undefined}
                companyLinkedin={contact.companyLinkedin || undefined}
                companyTwitter={contact.companyTwitter || undefined}
                companyFacebook={contact.companyFacebook || undefined}
                companyAngellist={contact.companyAngellist || undefined}
                companyCrunchbase={contact.companyCrunchbase || undefined}
                companyOwler={contact.companyOwler || undefined}
                youtubeVimeo={contact.youtubeVimeo || undefined}
                geo={undefined}
                relationshipStrength={0.5}
                tags={[]}
                lastInteractionAt={contact.updatedAt.toISOString()}
                contactType={contact.contactType || undefined}
                isLp={contact.isLp || false}
                isInvestor={contact.isInvestor || false}
                checkSizeMin={contact.checkSizeMin || undefined}
                checkSizeMax={contact.checkSizeMax || undefined}
                investorNotes={contact.investorNotes || undefined}
                onEdit={() => {
                  setEditingContact(contact);
                  setShowContactDialog(true);
                }}
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
        onOpenChange={(open) => {
          setShowContactDialog(open);
          if (!open) {
            setEditingContact(null);
          }
        }}
        contact={editingContact}
      />
      
      <CsvUploadDialog
        open={showCsvUploadDialog}
        onOpenChange={setShowCsvUploadDialog}
      />
    </div>
  );
}
