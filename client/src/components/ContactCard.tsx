import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Edit, DollarSign, TrendingUp, Users, Calendar, Sparkles, Mail, Linkedin, MapPin, Phone, Tag, Twitter as TwitterIcon, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import EnrichmentDialog from "@/components/EnrichmentDialog";
import RoleTag from "@/components/RoleTag";
import { formatCheckSizeRange } from "@/lib/currencyFormat";

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
  contactType?: ('LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other')[];
  isInvestor?: boolean;
  checkSizeMin?: number;
  checkSizeMax?: number;
  investorNotes?: string;
}

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
  
  const hasCompanyInfo = !!(companyAddress || companyEmployees || companyFounded || companyUrl || 
    companyLinkedin || companyTwitter || companyFacebook || companyAngellist || 
    companyCrunchbase || companyOwler || youtubeVimeo);

  return (
    <Card className="p-5 hover-elevate" data-testid={`contact-card-${id}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold truncate" data-testid="text-contact-name">
                {fullName}
              </h3>
              {contactType && contactType.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {contactType.map((type) => (
                    <RoleTag key={type} type={type} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
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
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
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
              >
                {phone}
              </a>
            </div>
          )}
          
          {/* 8. Category */}
          {category && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-xs" data-testid="badge-category">
                {category}
              </Badge>
            </div>
          )}
          
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
                href={angellist}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                data-testid="link-angellist"
              >
                AngelList Profile
              </a>
            </div>
          )}
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
