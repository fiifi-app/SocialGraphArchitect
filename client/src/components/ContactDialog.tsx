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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateContact, useUpdateContact, useDeleteContact } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { Contact } from "@shared/schema";
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
});

type ContactFormData = z.infer<typeof contactFormSchema>;

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
      });
    }
  }, [contact, open, form]);

  const onSubmit = async (data: ContactFormData) => {
    try {
      const fullName = `${data.firstName}${data.lastName ? ' ' + data.lastName : ''}`;
      
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-contact">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update contact information" : "Add a new contact to your network"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 pr-4">
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
