import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateContact, useUpdateContact, useDeleteContact } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { Contact } from "@shared/schema";
import { useFeatureFlags } from "@/lib/featureFlags";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

// Updated schema with all contact fields
const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  title: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  location: z.string().optional(),
  phone: z.string().optional(),
  category: z.string().optional(),
  twitter: z.string().optional(),
  angellist: z.string().optional(),
  bio: z.string().optional(),
  
  // Company information fields
  companyAddress: z.string().optional(),
  companyEmployees: z.string().optional(),
  companyFounded: z.string().optional(),
  companyUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  companyLinkedin: z.string().url("Invalid URL").optional().or(z.literal("")),
  companyTwitter: z.string().optional(),
  companyFacebook: z.string().optional(),
  companyAngellist: z.string().optional(),
  companyCrunchbase: z.string().optional(),
  companyOwler: z.string().optional(),
  youtubeVimeo: z.string().optional(),
  
  // Investor Profile fields
  isInvestor: z.boolean().default(false),
  contactType: z.array(z.enum(['LP', 'GP', 'Angel', 'FamilyOffice', 'Startup', 'Other'])).default([]),
  checkSizeMin: z.number().int().positive().optional().or(z.literal(0)),
  checkSizeMax: z.number().int().positive().optional().or(z.literal(0)),
  investorNotes: z.string().optional(),
}).refine(
  (data) => {
    // Validate check_size_min <= check_size_max
    if (data.checkSizeMin && data.checkSizeMax && data.checkSizeMin > 0 && data.checkSizeMax > 0) {
      return data.checkSizeMin <= data.checkSizeMax;
    }
    return true;
  },
  {
    message: "Min check size cannot exceed max",
    path: ["checkSizeMin"],
  }
);

type ContactFormData = z.infer<typeof contactFormSchema>;

// Helper function to determine if any contact types indicate an investor
// LP, GP, Angel, and FamilyOffice are all capital allocators
const hasInvestorType = (contactTypes: string[]): boolean => {
  return contactTypes.some(type => type === 'LP' || type === 'GP' || type === 'Angel' || type === 'FamilyOffice');
};

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact; // If provided, dialog is in edit mode
}

export default function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const isEditMode = !!contact;
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { data: featureFlags } = useFeatureFlags();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      title: "",
      company: "",
      linkedinUrl: "",
      location: "",
      phone: "",
      category: "",
      twitter: "",
      angellist: "",
      bio: "",
      companyAddress: "",
      companyEmployees: "",
      companyFounded: "",
      companyUrl: "",
      companyLinkedin: "",
      companyTwitter: "",
      companyFacebook: "",
      companyAngellist: "",
      companyCrunchbase: "",
      companyOwler: "",
      youtubeVimeo: "",
      isInvestor: false,
      contactType: [],
      checkSizeMin: 0,
      checkSizeMax: 0,
      investorNotes: "",
    },
  });

  // Update form when contact changes
  useEffect(() => {
    if (contact && open) {
      form.reset({
        firstName: contact.firstName || contact.name.split(" ")[0] || "",
        lastName: contact.lastName || contact.name.split(" ").slice(1).join(" ") || "",
        email: contact.email || "",
        title: contact.title || "",
        company: contact.company || "",
        linkedinUrl: contact.linkedinUrl || "",
        location: contact.location || "",
        phone: contact.phone || "",
        category: contact.category || "",
        twitter: contact.twitter || "",
        angellist: contact.angellist || "",
        bio: contact.bio || "",
        companyAddress: contact.companyAddress || "",
        companyEmployees: contact.companyEmployees || "",
        companyFounded: contact.companyFounded || "",
        companyUrl: contact.companyUrl || "",
        companyLinkedin: contact.companyLinkedin || "",
        companyTwitter: contact.companyTwitter || "",
        companyFacebook: contact.companyFacebook || "",
        companyAngellist: contact.companyAngellist || "",
        companyCrunchbase: contact.companyCrunchbase || "",
        companyOwler: contact.companyOwler || "",
        youtubeVimeo: contact.youtubeVimeo || "",
        isInvestor: contact.isInvestor || false,
        contactType: contact.contactType || [],
        checkSizeMin: contact.checkSizeMin || 0,
        checkSizeMax: contact.checkSizeMax || 0,
        investorNotes: contact.investorNotes || "",
      });
    } else if (!open) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        title: "",
        company: "",
        linkedinUrl: "",
        location: "",
        phone: "",
        category: "",
        twitter: "",
        angellist: "",
        bio: "",
        companyAddress: "",
        companyEmployees: "",
        companyFounded: "",
        companyUrl: "",
        companyLinkedin: "",
        companyTwitter: "",
        companyFacebook: "",
        companyAngellist: "",
        companyCrunchbase: "",
        companyOwler: "",
        youtubeVimeo: "",
        isInvestor: false,
        contactType: [],
        checkSizeMin: 0,
        checkSizeMax: 0,
        investorNotes: "",
      });
    }
  }, [contact, open, form]);

  // Auto-update isInvestor when contactType changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'contactType') {
        const types = (value.contactType || []).filter(Boolean) as string[];
        const shouldBeInvestor = hasInvestorType(types);
        form.setValue('isInvestor', shouldBeInvestor);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-detect contact types from title field
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'title' && value.title) {
        const titleLower = value.title.toLowerCase();
        const currentTypes = value.contactType || [];
        const detectedTypes = new Set<'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other'>(currentTypes.filter((t): t is 'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other' => t !== undefined));

        // Define keywords and their corresponding contact types
        const typeKeywords: Array<{ keywords: string[], type: 'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' }> = [
          { keywords: ['general partner', 'gp'], type: 'GP' as const },
          { keywords: ['limited partner', 'lp'], type: 'LP' as const },
          { keywords: ['angel investor', 'angel'], type: 'Angel' as const },
          { keywords: ['family office'], type: 'FamilyOffice' as const },
          { keywords: ['startup', 'founder', 'ceo', 'cto', 'cofounder', 'co-founder'], type: 'Startup' as const },
        ];

        // Check for each keyword and add the corresponding type
        for (const { keywords, type } of typeKeywords) {
          for (const keyword of keywords) {
            if (titleLower.includes(keyword)) {
              detectedTypes.add(type);
              break; // Found a match for this type, no need to check other keywords
            }
          }
        }

        // Update contactType if any new types were detected
        const newTypes = Array.from(detectedTypes);
        if (newTypes.length > currentTypes.filter(t => t !== undefined).length) {
          form.setValue('contactType', newTypes);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (data: ContactFormData) => {
    try {
      const fullName = `${data.firstName}${data.lastName ? ' ' + data.lastName : ''}`;
      
      // Derive isInvestor from contactType array to ensure consistency
      const derivedIsInvestor = hasInvestorType(data.contactType);
      
      const contactData = {
        name: fullName,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        title: data.title || null,
        company: data.company || null,
        linkedinUrl: data.linkedinUrl || null,
        location: data.location || null,
        phone: data.phone || null,
        category: data.category || null,
        twitter: data.twitter || null,
        angellist: data.angellist || null,
        companyAddress: data.companyAddress || null,
        companyEmployees: data.companyEmployees || null,
        companyFounded: data.companyFounded || null,
        companyUrl: data.companyUrl || null,
        companyLinkedin: data.companyLinkedin || null,
        companyTwitter: data.companyTwitter || null,
        companyFacebook: data.companyFacebook || null,
        companyAngellist: data.companyAngellist || null,
        companyCrunchbase: data.companyCrunchbase || null,
        companyOwler: data.companyOwler || null,
        youtubeVimeo: data.youtubeVimeo || null,
        isInvestor: derivedIsInvestor, // Use derived value from contact types
        contactType: data.contactType || [],
        checkSizeMin: (data.checkSizeMin && data.checkSizeMin > 0) ? data.checkSizeMin : null,
        checkSizeMax: (data.checkSizeMax && data.checkSizeMax > 0) ? data.checkSizeMax : null,
        investorNotes: data.investorNotes || null,
      };
      
      if (isEditMode) {
        await updateContact.mutateAsync({
          id: contact.id,
          ...contactData,
        });

        toast({
          title: "Contact updated!",
          description: `${fullName} has been updated`,
        });
      } else {
        await createContact.mutateAsync(contactData);

        toast({
          title: "Contact created!",
          description: `${fullName} has been added to your contacts`,
        });
      }

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: `Failed to ${isEditMode ? 'update' : 'create'} contact`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!contact) return;

    try {
      await deleteContact.mutateAsync(contact.id);
      
      toast({
        title: "Contact deleted",
        description: `${contact.name} has been removed from your contacts`,
      });

      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to delete contact",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="dialog-contact">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isEditMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update contact information" : "Add a new contact to your network"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="h-[calc(90vh-220px)] pr-4">
                <div className="pr-2">
                <div className="space-y-4">
                  {/* Name */}
                  <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="John"
                          data-testid="input-contact-firstname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Doe"
                          data-testid="input-contact-lastname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="john@example.com"
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title & Company */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Partner"
                          data-testid="input-contact-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Acme Ventures"
                          data-testid="input-contact-company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* LinkedIn & Location */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://linkedin.com/in/johndoe"
                          data-testid="input-contact-linkedin"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="San Francisco, CA"
                          data-testid="input-contact-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Phone & Category */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+1 (555) 123-4567"
                          data-testid="input-contact-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Investor, LP, Founder, etc."
                          data-testid="input-contact-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Twitter & AngelList */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="@username or URL"
                          data-testid="input-contact-twitter"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="angellist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AngelList</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="AngelList profile URL"
                          data-testid="input-contact-angellist"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* About Section */}
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>About</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="LinkedIn bio or additional information about this contact..."
                        className="min-h-24"
                        data-testid="input-contact-bio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Investor Profile Section - Feature Flagged */}
              {featureFlags?.enableInvestorFields && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Investor Profile</h3>
                  
                  <div className="space-y-4">
                    {/* Contact Type - Multi-Select Toggle Buttons */}
                    <FormField
                      control={form.control}
                      name="contactType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Type (select all that apply)</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'LP', label: 'LP' },
                              { value: 'GP', label: 'GP' },
                              { value: 'Angel', label: 'Angel' },
                              { value: 'FamilyOffice', label: 'Family Office' },
                              { value: 'Startup', label: 'Startup' },
                              { value: 'Other', label: 'Other' },
                            ].map((type) => {
                              const isSelected = field.value?.includes(type.value as any);
                              return (
                                <Button
                                  key={type.value}
                                  type="button"
                                  variant={isSelected ? 'default' : 'outline'}
                                  className="toggle-elevate"
                                  onClick={() => {
                                    const currentValue = field.value || [];
                                    const newValue = isSelected
                                      ? currentValue.filter((v) => v !== type.value)
                                      : [...currentValue, type.value as any];
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`button-contact-type-${type.value.toLowerCase()}`}
                                >
                                  {type.label}
                                </Button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Conditional Investor Fields - Show if ANY type is GP, Angel, or FamilyOffice */}
                    {hasInvestorType(form.watch('contactType') || []) && (
                      <>
                        {/* Check Size Range */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="checkSizeMin"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Check Size Min ($)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="e.g., 250000"
                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                    data-testid="input-check-size-min"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="checkSizeMax"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Check Size Max ($)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="e.g., 2000000"
                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                    data-testid="input-check-size-max"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Investor Notes */}
                        <FormField
                          control={form.control}
                          name="investorNotes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investor Notes</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Investment preferences, notes, etc."
                                  className="resize-none"
                                  rows={3}
                                  data-testid="textarea-investor-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Company Information Section */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Company Information (Optional)</h4>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="companyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Address</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123 Main St, City, State" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyEmployees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel># of Employees</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="1-10, 50-200, etc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyFounded"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year Founded</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="2020" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="companyUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Website</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://company.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyLinkedin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company LinkedIn</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://linkedin.com/company/..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyTwitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Twitter</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="@companyname" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyFacebook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Facebook</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Facebook URL or handle" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyAngellist"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company AngelList</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="AngelList URL" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyCrunchbase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Crunchbase</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Crunchbase URL" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyOwler"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Owler</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Owler URL" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="youtubeVimeo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>YouTube/Vimeo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Video channel or profile URL" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              </div>
              </div>
              </ScrollArea>

              <DialogFooter className="gap-2 mt-4 flex-shrink-0">
                {isEditMode && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteContact.isPending}
                    className="mr-auto"
                    data-testid="button-delete-contact"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    onOpenChange(false);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createContact.isPending || updateContact.isPending}
                  data-testid="button-submit-contact"
                >
                  {(createContact.isPending || updateContact.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    isEditMode ? "Update Contact" : "Create Contact"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contact?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
