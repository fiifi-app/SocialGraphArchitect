import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  UserCheck, 
  UserX, 
  Search, 
  Mail, 
  Building2, 
  Briefcase,
  MapPin,
  Phone 
} from "lucide-react";
import { useContacts, useUpdateContact, useDeleteContact } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import RoleTag from "@/components/RoleTag";

// Helper function to auto-detect contact types from title
const detectContactTypesFromTitle = (title: string | undefined): ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other')[] => {
  if (!title) return [];
  
  const titleLower = title.toLowerCase();
  const detectedTypes: ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other')[] = [];
  
  const typeKeywords: Array<{ keywords: string[], type: 'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other' }> = [
    { keywords: ['general partner', ' gp', 'gp '], type: 'GP' },
    { keywords: ['limited partner', ' lp', 'lp '], type: 'LP' },
    { keywords: ['angel investor', 'angel'], type: 'Angel' },
    { keywords: ['family office'], type: 'FamilyOffice' },
    { keywords: ['startup', 'founder', ' ceo', 'ceo ', ' cto', 'cto ', 'cofounder', 'co-founder'], type: 'Startup' },
    { keywords: ['private equity', ' pe', 'pe '], type: 'Other' },
  ];
  
  for (const { keywords, type } of typeKeywords) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        detectedTypes.push(type);
        break;
      }
    }
  }
  
  return detectedTypes;
};

export default function PendingContacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allContacts = [], isLoading } = useContacts();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { toast } = useToast();

  // Filter for pending contacts only
  const pendingContacts = allContacts.filter(c => c.status === 'pending');

  // Apply search filter
  const filteredContacts = pendingContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAccept = async (contactId: string, contactName: string) => {
    try {
      await updateContact.mutateAsync({
        id: contactId,
        status: 'verified',
      });

      toast({
        title: "Contact accepted",
        description: `${contactName} has been added to your contacts.`,
      });
    } catch (error) {
      console.error('Error accepting contact:', error);
      toast({
        title: "Error",
        description: "Failed to accept contact. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (contactId: string, contactName: string) => {
    try {
      await deleteContact.mutateAsync(contactId);

      toast({
        title: "Contact rejected",
        description: `${contactName} has been removed.`,
      });
    } catch (error) {
      console.error('Error rejecting contact:', error);
      toast({
        title: "Error",
        description: "Failed to reject contact. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading pending contacts...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Pending Contacts</h1>
        <p className="text-muted-foreground">
          Review and accept contacts discovered from your conversations
        </p>
      </div>

      {pendingContacts.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pending contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-pending"
            />
          </div>
        </div>
      )}

      {pendingContacts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">No pending contacts</h2>
              <p className="text-muted-foreground max-w-md">
                Contacts discovered during your conversations will appear here for review.
                Start a new recording to find potential connections!
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredContacts.length} pending contact{filteredContacts.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => {
              // Auto-detect contact types from title if not set
              const displayContactTypes = contact.contactType && contact.contactType.length > 0 
                ? contact.contactType 
                : detectContactTypesFromTitle(contact.title || undefined);
              
              return (
              <Card 
                key={contact.id} 
                className="p-6 hover-elevate"
                data-testid={`card-pending-contact-${contact.id}`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-semibold truncate">
                          {contact.name}
                        </h3>
                        {displayContactTypes.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {displayContactTypes.map((type) => (
                              <RoleTag key={type} type={type} />
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Pending Review
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    {contact.title && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{contact.title}</span>
                      </div>
                    )}
                    {contact.company && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{contact.company}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{contact.email}</span>
                      </div>
                    )}
                    {contact.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{contact.location}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAccept(contact.id, contact.name)}
                      disabled={updateContact.isPending}
                      data-testid={`button-accept-${contact.id}`}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleReject(contact.id, contact.name)}
                      disabled={deleteContact.isPending}
                      data-testid={`button-reject-${contact.id}`}
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
