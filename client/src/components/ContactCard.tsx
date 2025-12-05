import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, Users, Calendar, Sparkles, Mail, Linkedin, MapPin, Phone, Tag, Twitter as TwitterIcon, Info, BrainCircuit, Loader2, Target, TrendingUp, Globe } from "lucide-react";

const ExpandIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 -960 960 960" 
    fill="currentColor"
    className={className}
  >
    <path d="M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z"/>
  </svg>
);
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import EnrichmentDialog from "@/components/EnrichmentDialog";
import RoleTag from "@/components/RoleTag";
import { formatCheckSizeRange } from "@/lib/currencyFormat";
import { useContactThesis, useExtractThesis } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

interface ContactCardProps {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  role: string;
  org?: string;
  email?: string;
  linkedinUrl?: string;
  location?: string;
  phone?: string;
  category?: string;
  twitter?: string;
  angellist?: string;
  bio?: string;
  
  // Company Information (shown in More Information)
  companyAddress?: string;
  companyEmployees?: string;
  companyFounded?: string;
  companyUrl?: string;
  companyLinkedin?: string;
  companyTwitter?: string;
  companyFacebook?: string;
  companyAngellist?: string;
  companyCrunchbase?: string;
  companyOwler?: string;
  youtubeVimeo?: string;
  
  // Legacy fields
  geo?: string;
  relationshipStrength: number;
  tags: string[];
  lastInteractionAt?: string;
  onEdit: () => void;
  
  // Investor Profile fields
  contactType?: ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'PE')[];
  isInvestor?: boolean;
  checkSizeMin?: number;
  checkSizeMax?: number;
  investorNotes?: string;
}

// Helper function to auto-detect contact types from title
const detectContactTypesFromTitle = (title: string | undefined): ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'PE')[] => {
  if (!title) return [];
  
  const titleLower = title.toLowerCase();
  const detectedTypes: ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'PE')[] = [];
  
  const typeKeywords: Array<{ keywords: string[], type: 'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'PE' }> = [
    { keywords: ['general partner', ' gp', 'gp '], type: 'GP' },
    { keywords: ['limited partner', ' lp', 'lp '], type: 'LP' },
    { keywords: ['angel investor', 'angel'], type: 'Angel' },
    { keywords: ['family office'], type: 'FamilyOffice' },
    { keywords: ['startup', 'founder', ' ceo', 'ceo ', ' cto', 'cto ', 'cofounder', 'co-founder'], type: 'Startup' },
    { keywords: ['private equity', ' pe', 'pe '], type: 'PE' },
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

export default function ContactCard({
  id,
  fullName,
  firstName,
  lastName,
  role,
  org,
  email,
  linkedinUrl,
  location,
  phone,
  category,
  twitter,
  angellist,
  bio,
  companyAddress,
  companyEmployees,
  companyFounded,
  companyUrl,
  companyLinkedin,
  companyTwitter,
  companyFacebook,
  companyAngellist,
  companyCrunchbase,
  companyOwler,
  youtubeVimeo,
  geo,
  relationshipStrength,
  tags,
  lastInteractionAt,
  onEdit,
  contactType,
  isInvestor = false,
  checkSizeMin,
  checkSizeMax,
  investorNotes,
}: ContactCardProps) {
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const { toast } = useToast();
  
  const { data: thesis, isLoading: thesisLoading } = useContactThesis(id);
  const extractThesisMutation = useExtractThesis();
  
  const handleExtractThesis = async () => {
    try {
      await extractThesisMutation.mutateAsync(id);
      toast({
        title: "Thesis extracted",
        description: "Investment keywords have been extracted from the profile.",
      });
    } catch (error: any) {
      toast({
        title: "Extraction failed",
        description: error.message || "Could not extract thesis keywords.",
        variant: "destructive",
      });
    }
  };
  
  const hasCompanyInfo = !!(companyAddress || companyEmployees || companyFounded || companyUrl || 
    companyLinkedin || companyTwitter || companyFacebook || companyAngellist || 
    companyCrunchbase || companyOwler || youtubeVimeo);
  
  const hasThesisData = thesis && (
    thesis.sectors.length > 0 || 
    thesis.stages.length > 0 || 
    thesis.geos.length > 0 ||
    thesis.checkSizes.length > 0 ||
    thesis.personas.length > 0
  );
  
  // Use provided contactType or auto-detect from title if not set
  const displayContactTypes = contactType && contactType.length > 0 
    ? contactType 
    : detectContactTypesFromTitle(role);

  return (
    <Card className="p-5 hover-elevate" data-testid={`contact-card-${id}`}>
      <div className="space-y-3">
        {/* Icons at the top, right-aligned */}
        <div className="flex items-center justify-end gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid="button-more-info"
                title="View company information"
              >
                <Info className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end" sideOffset={5}>
                <div className="p-4 border-b">
                  <h4 className="font-semibold text-sm">Company Information</h4>
                </div>
                <ScrollArea className="max-h-96">
                  <div className="p-4 space-y-3 text-sm min-h-0">
                    {!hasCompanyInfo ? (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        No company information available
                      </div>
                    ) : (
                      <>
                      {companyAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Address</div>
                            <div>{companyAddress}</div>
                          </div>
                        </div>
                      )}
                      
                      {companyEmployees && (
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground"># of Employees</div>
                            <div>{companyEmployees}</div>
                          </div>
                        </div>
                      )}
                      
                      {companyFounded && (
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Founded</div>
                            <div>{companyFounded}</div>
                          </div>
                        </div>
                      )}
                      
                      {companyUrl && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Website</div>
                            <a href={companyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                              {companyUrl}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyLinkedin && (
                        <div className="flex items-start gap-2">
                          <Linkedin className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company LinkedIn</div>
                            <a href={companyLinkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              LinkedIn Profile
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyTwitter && (
                        <div className="flex items-start gap-2">
                          <TwitterIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Twitter</div>
                            <a
                              href={companyTwitter.startsWith('http') ? companyTwitter : `https://twitter.com/${companyTwitter.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {companyTwitter}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyFacebook && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Facebook</div>
                            <a href={companyFacebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Facebook Page
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyAngellist && (
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company AngelList</div>
                            <a href={companyAngellist} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              AngelList Profile
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyCrunchbase && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Crunchbase</div>
                            <a href={companyCrunchbase} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Crunchbase Profile
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {companyOwler && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">Company Owler</div>
                            <a href={companyOwler} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Owler Profile
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {youtubeVimeo && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">YouTube/Vimeo</div>
                            <a href={youtubeVimeo} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Video Channel
                            </a>
                          </div>
                        </div>
                      )}
                    </>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowEnrichDialog(true)}
              data-testid="button-enrich-contact"
              title="Enrich contact data"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid="button-edit-contact"
            title="Expand contact details"
          >
            <ExpandIcon className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Name and role tags below icons */}
        <div>
          {displayContactTypes.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-1">
              {displayContactTypes.map((type) => (
                <RoleTag key={type} type={type} />
              ))}
            </div>
          )}
          <h3 className="text-base font-semibold" data-testid="text-contact-name">
            {fullName}
          </h3>
        </div>
        
        <EnrichmentDialog
          contactId={id}
          contactName={fullName}
          open={showEnrichDialog}
          onOpenChange={setShowEnrichDialog}
        />

        {/* Main Contact Information */}
        <div className="space-y-2">
          {/* 1. Name - already displayed in header */}
          
          {/* 2. Email */}
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={`mailto:${email}`}
                className="truncate text-primary hover:underline"
                data-testid="link-email"
                onClick={(e) => e.stopPropagation()}
              >
                {email}
              </a>
            </div>
          )}
          
          {/* 3. Title */}
          {role && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{role}</span>
            </div>
          )}
          
          {/* 4. Company */}
          {org && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{org}</span>
            </div>
          )}
          
          {/* 5. LinkedIn */}
          {linkedinUrl && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                data-testid="link-linkedin-full"
                onClick={(e) => e.stopPropagation()}
              >
                LinkedIn Profile
              </a>
            </div>
          )}
          
          {/* 6. Location */}
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}
          
          {/* 7. Phone */}
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={`tel:${phone}`}
                className="truncate text-primary hover:underline"
                data-testid="link-phone"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
            </div>
          )}
          
          {/* 8. Category - HIDDEN: Contact type tags next to name replace this */}
          
          {/* 9. Twitter */}
          {twitter && (
            <div className="flex items-center gap-2 text-sm">
              <TwitterIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                data-testid="link-twitter"
                onClick={(e) => e.stopPropagation()}
              >
                {twitter}
              </a>
            </div>
          )}
          
          {/* 10. AngelList */}
          {angellist && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={angellist.startsWith('http') ? angellist : `https://angel.co/${angellist.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                data-testid="link-angellist"
                onClick={(e) => e.stopPropagation()}
              >
                AngelList Profile
              </a>
            </div>
          )}
          
          {/* 11. Bio (first 140 characters, no heading) */}
          {bio && bio.trim() && (
            <div className="text-sm text-muted-foreground pt-1" data-testid="text-bio">
              {bio.substring(0, 140)}{bio.length > 140 ? '...' : ''}
            </div>
          )}
          
          {/* Thesis Keywords Section */}
          {hasThesisData ? (
            <div className="pt-2 space-y-2" data-testid="thesis-section">
              {thesis.sectors.length > 0 && (
                <div className="flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {thesis.sectors.map((sector, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {sector}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {thesis.stages.length > 0 && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {thesis.stages.map((stage, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {stage}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {thesis.geos.length > 0 && (
                <div className="flex items-start gap-2">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {thesis.geos.map((geo, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {geo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {thesis.personas.length > 0 && (
                <div className="flex items-start gap-2">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {thesis.personas.map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-primary/5">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (bio || investorNotes) && !thesisLoading ? (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 text-xs"
              onClick={handleExtractThesis}
              disabled={extractThesisMutation.isPending}
              data-testid="button-extract-thesis"
            >
              {extractThesisMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-3 h-3 mr-1" />
                  Extract thesis keywords
                </>
              )}
            </Button>
          ) : null}
        </div>

        {/* Investor info - check size */}
        {(checkSizeMin || checkSizeMax) && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground" data-testid="text-check-size">
                {formatCheckSizeRange(checkSizeMin, checkSizeMax)}
              </span>
            </div>
          </>
        )}

        {lastInteractionAt && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            Last: {new Date(lastInteractionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </Card>
  );
}
